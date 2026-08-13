'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Loader2, Coins, ArrowLeft, Copy, Check, BookOpen, Trash2, Upload, Link2, Plus } from 'lucide-react'
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

interface KnowledgeSource {
  id: string
  type: 'url' | 'file' | 'text'
  name: string
  source_url: string | null
  char_count: number
  created_at: string
}

const CATEGORY_LABEL: Record<string, string> = {
  copywriting: '文案',
  video: '短影音',
  illustration: '配圖',
  research: '研究',
  audio: '語音',
  presentation: '簡報',
  social: '社群',
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

  // 內建專家「知識附掛」（TEAM+）：對目前選中的專家上傳連結／文字／檔案作為專屬知識庫
  const [kSources, setKSources] = useState<KnowledgeSource[]>([])
  const [kCanBuild, setKCanBuild] = useState(false)
  const [kTab, setKTab] = useState<'url' | 'text' | 'file'>('url')
  const [kUrl, setKUrl] = useState('')
  const [kText, setKText] = useState('')
  const [kName, setKName] = useState('')
  const [kBusy, setKBusy] = useState(false)
  const [kError, setKError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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
    // 載入該專家的知識庫
    setKSources([])
    setKError('')
    setKUrl('')
    setKText('')
    setKName('')
    loadKnowledge(s.id)
  }

  async function loadKnowledge(skillId: string) {
    try {
      const res = await fetch(`/api/marketing/skill-knowledge?skillId=${encodeURIComponent(skillId)}`)
      const data = await res.json()
      if (res.ok) {
        setKSources(data.sources ?? [])
        setKCanBuild(!!data.canBuild)
      }
    } catch {
      /* 靜默 */
    }
  }

  async function addKnowledge(payload: Record<string, unknown>) {
    if (!selected) return
    setKBusy(true)
    setKError('')
    try {
      const res = await fetch('/api/marketing/skill-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: selected.id, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        setKError(res.status === 403 ? '訓練專家知識需 TEAM 以上方案' : (data.error ?? '新增失敗'))
        return
      }
      if (data.source) setKSources(v => [data.source, ...v])
      if (typeof data.balance === 'number') setBalance(data.balance)
      setKUrl('')
      setKText('')
      setKName('')
    } catch {
      setKError('連線失敗')
    } finally {
      setKBusy(false)
    }
  }

  async function addFile(file: File) {
    if (!selected) return
    setKBusy(true)
    setKError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('category', 'document')
      const up = await fetch('/api/marketing/upload-file', { method: 'POST', body: form })
      const upData = await up.json()
      if (!up.ok) {
        setKError(upData.error ?? '檔案上傳失敗')
        return
      }
      if (!upData.textContent) {
        setKError('此檔案無法萃取文字內容（僅支援 docx / xlsx / csv / txt / pdf）')
        return
      }
      await addKnowledge({ type: 'file', text: upData.textContent, name: upData.name })
    } catch {
      setKError('檔案處理失敗')
    } finally {
      setKBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function delKnowledge(id: string) {
    setKSources(v => v.filter(s => s.id !== id))
    try {
      await fetch(`/api/marketing/skill-knowledge?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    } catch {
      /* 已從列表移除，忽略錯誤 */
    }
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

          {/* 內建專家「知識附掛」：訓練這位專家（TEAM+） */}
          <div className="mt-6 border rounded-xl bg-white">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <BookOpen className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-semibold text-gray-800">訓練這位專家</span>
              <span className="text-[11px] text-gray-400">上傳連結／文字／檔案，執行時自動參考</span>
            </div>

            {!kCanBuild ? (
              <div className="px-4 py-4 text-sm text-gray-500">
                訓練專屬知識庫為 <span className="font-medium text-indigo-600">TEAM 以上方案</span> 功能。升級後可讓這位專家學習你上傳的爆款案例、風格與資料。
              </div>
            ) : (
              <div className="px-4 py-4 space-y-3">
                {kSources.length > 0 && (
                  <ul className="space-y-1.5">
                    {kSources.map(s => (
                      <li key={s.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-[10px] font-medium text-gray-500 bg-white border rounded px-1.5 py-0.5">
                          {s.type === 'url' ? '連結' : s.type === 'file' ? '檔案' : '文字'}
                        </span>
                        {s.source_url ? (
                          <a href={s.source_url} target="_blank" rel="noreferrer"
                            className="flex-1 truncate text-indigo-600 hover:underline">{s.name}</a>
                        ) : (
                          <span className="flex-1 truncate text-gray-700">{s.name}</span>
                        )}
                        <span className="text-[11px] text-gray-400">{s.char_count} 字</span>
                        <button onClick={() => delKnowledge(s.id)} className="text-gray-400 hover:text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex gap-1 text-xs">
                  {(['url', 'text', 'file'] as const).map(t => (
                    <button key={t} onClick={() => { setKTab(t); setKError('') }}
                      className={cn('px-3 py-1.5 rounded-full border',
                        kTab === t ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white text-gray-500 hover:text-gray-800')}>
                      {t === 'url' ? '網址連結' : t === 'text' ? '貼上文字' : '上傳檔案'}
                    </button>
                  ))}
                </div>

                {kTab === 'url' && (
                  <div className="flex gap-2">
                    <Input placeholder="https://…（文章 / 貼文 / 網頁）" value={kUrl}
                      onChange={e => setKUrl(e.target.value)} />
                    <Button variant="outline" disabled={kBusy || !kUrl.trim()}
                      onClick={() => addKnowledge({ type: 'url', url: kUrl.trim() })}>
                      {kBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    </Button>
                  </div>
                )}

                {kTab === 'text' && (
                  <div className="space-y-2">
                    <Input placeholder="這份知識的名稱（選填）" value={kName}
                      onChange={e => setKName(e.target.value)} />
                    <Textarea rows={4} placeholder="貼上爆款案例、方法論、風格範例等文字…" value={kText}
                      onChange={e => setKText(e.target.value)} />
                    <Button variant="outline" disabled={kBusy || !kText.trim()}
                      onClick={() => addKnowledge({ type: 'text', text: kText.trim(), name: kName.trim() })}>
                      {kBusy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> 新增中…</> : <><Plus className="h-4 w-4 mr-2" /> 加入知識</>}
                    </Button>
                  </div>
                )}

                {kTab === 'file' && (
                  <div>
                    <input ref={fileRef} type="file" accept=".docx,.xlsx,.xls,.csv,.txt,.pdf" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) addFile(f) }} />
                    <Button variant="outline" disabled={kBusy} onClick={() => fileRef.current?.click()}>
                      {kBusy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> 處理中…</> : <><Upload className="h-4 w-4 mr-2" /> 選擇檔案</>}
                    </Button>
                    <p className="text-[11px] text-gray-400 mt-1.5">支援 docx / xlsx / csv / txt / pdf，自動萃取文字</p>
                  </div>
                )}

                {kError && <div className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{kError}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
