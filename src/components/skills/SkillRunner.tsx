'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Loader2, Coins, ArrowLeft, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils/cn'

interface SkillField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number'
  required?: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
  default?: string | number
}

interface SkillInfo {
  id: string
  label: string
  description: string
  category: string
  priceCredits: number
  fields: SkillField[]
}

const CATEGORY_LABEL: Record<string, string> = {
  copywriting: '文案',
  video: '短影音',
  illustration: '配圖',
  research: '研究',
  audio: '語音',
  presentation: '簡報',
  social: '社群',
  decision: '決策',
}

/**
 * 共用 skill 執行器：依 module 列出對應 skill，填表單→執行→顯示結果。
 * 行銷中心「專家模式」與「思維決策」共用此元件。
 */
export function SkillRunner({ module, title }: { module: string; title: string }) {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [balance, setBalance] = useState<number | null>(null)
  const [selected, setSelected] = useState<SkillInfo | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [lastCost, setLastCost] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/skills?module=${encodeURIComponent(module)}`)
      .then(r => r.json())
      .then(d => {
        setSkills(d.skills ?? [])
        if (typeof d.balance === 'number') setBalance(d.balance)
      })
      .catch(() => setError('載入 skill 清單失敗'))
  }, [module])

  function openSkill(s: SkillInfo) {
    setSelected(s)
    setOutput('')
    setError('')
    setLastCost(null)
    const init: Record<string, string> = {}
    for (const f of s.fields) init[f.name] = f.default != null ? String(f.default) : ''
    setValues(init)
  }

  async function run() {
    if (!selected) return
    const missing = selected.fields.find(f => f.required && !values[f.name]?.trim())
    if (missing) {
      setError(`請填寫：${missing.label}`)
      return
    }
    setRunning(true)
    setError('')
    setOutput('')
    try {
      const res = await fetch('/api/skills/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: selected.id, input: values }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 402) setError(`點數不足，本次需要約 ${data.required ?? selected.priceCredits} 點`)
        else setError(data.error ?? '執行失敗')
        if (typeof data.balance === 'number') setBalance(data.balance)
        return
      }
      setOutput(data.output ?? '')
      setLastCost(data.creditsSpent ?? null)
      if (typeof data.balance === 'number') setBalance(data.balance)
    } catch {
      setError('連線失敗')
    } finally {
      setRunning(false)
    }
  }

  async function copyOutput() {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-600" />
          <h1 className="text-lg font-bold text-gray-800">{title}</h1>
        </div>
        {balance != null && (
          <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
            <Coins className="h-4 w-4 text-amber-500" />
            餘額 {balance.toFixed(2)} 點
          </div>
        )}
      </div>

      {!selected ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {skills.map(s => (
            <button key={s.id} onClick={() => openSkill(s)}
              className="text-left p-4 rounded-xl border bg-white hover:border-indigo-400 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {CATEGORY_LABEL[s.category] ?? s.category}
                </span>
                <span className="text-xs text-gray-400">{s.priceCredits} 點起</span>
              </div>
              <div className="font-semibold text-gray-800 text-sm">{s.label}</div>
              <div className="text-xs text-gray-500 mt-1 leading-relaxed">{s.description}</div>
            </button>
          ))}
          {skills.length === 0 && !error && (
            <div className="col-span-full text-center text-sm text-gray-400 py-10">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> 載入中…
            </div>
          )}
        </div>
      ) : (
        <div>
          <button onClick={() => setSelected(null)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
            <ArrowLeft className="h-4 w-4" /> 返回
          </button>

          <div className="mb-4">
            <h2 className="font-bold text-gray-800">{selected.label}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{selected.description}</p>
          </div>

          <div className="space-y-3">
            {selected.fields.map(f => (
              <div key={f.name}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {f.label}{f.required && <span className="text-rose-500"> *</span>}
                </label>
                {f.type === 'textarea' ? (
                  <Textarea rows={5} placeholder={f.placeholder}
                    value={values[f.name] ?? ''}
                    onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))} />
                ) : f.type === 'select' ? (
                  <select
                    className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm bg-white"
                    value={values[f.name] ?? ''}
                    onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))}>
                    {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <Input type={f.type === 'number' ? 'number' : 'text'} placeholder={f.placeholder}
                    value={values[f.name] ?? ''}
                    onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>

          {error && <div className="mt-3 text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</div>}

          <Button onClick={run} disabled={running} className="mt-4 w-full">
            {running ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> 生成中…</> : '執行'}
          </Button>

          {output && (
            <div className="mt-5 border rounded-xl bg-white">
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <span className="text-xs text-gray-500">
                  結果{lastCost != null && ` ・ 本次扣 ${lastCost.toFixed(2)} 點`}
                </span>
                <button onClick={copyOutput} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
                  {copied ? <><Check className="h-3.5 w-3.5" /> 已複製</> : <><Copy className="h-3.5 w-3.5" /> 複製</>}
                </button>
              </div>
              <pre className={cn('whitespace-pre-wrap break-words text-sm text-gray-800 px-4 py-3 font-sans')}>
                {output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
