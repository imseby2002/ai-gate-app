'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Loader2, Coins, ArrowLeft, Copy, Check, BookOpen, Trash2, Upload, Link2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useTranslations } from 'next-intl'
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
  hasKnowledge?: boolean
}

interface KnowledgeSource {
  id: string
  type: 'url' | 'file' | 'text'
  name: string
  source_url: string | null
  char_count: number
  created_at: string
}


/**
 * 共用 skill 執行器：依 module 列出對應 skill，填表單→執行→顯示結果。
 * 行銷中心「專家模式」與「思維決策」共用此元件。
 */
export function SkillRunner({ module, title }: { module: string; title: string }) {
  const t = useTranslations('SkillRunner')
  const ts = useTranslations('Skills')
  // skill 定義（label / 欄位）在 lib/skills/registry 以中文撰寫；有翻譯就套用，沒有就沿用原文
  const tr = (key: string, fallback: string) => (ts.has(key) ? ts(key) : fallback)
  const localize = (s: SkillInfo): SkillInfo => ({
    ...s,
    label: tr(`${s.id}.label`, s.label),
    description: tr(`${s.id}.description`, s.description),
    fields: s.fields.map(f => ({
      ...f,
      label: tr(`${s.id}.fields.${f.name}.label`, f.label),
      placeholder: f.placeholder && tr(`${s.id}.fields.${f.name}.placeholder`, f.placeholder),
      options: f.options?.map(o => ({ ...o, label: tr(`${s.id}.fields.${f.name}.options.${o.value}`, o.label) })),
    })),
  })
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [balance, setBalance] = useState<number | null>(null)
  const [selected, setSelected] = useState<SkillInfo | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [lastCost, setLastCost] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  // 內建專家「知識附掛」（PRO+）：對目前選中的專家上傳連結／文字／檔案作為專屬知識庫
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
        setSkills((d.skills ?? []).map(localize))
        if (typeof d.balance === 'number') setBalance(d.balance)
      })
      .catch(() => setError(t('loadFailed')))
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
        setKError(res.status === 403 ? t('trainNeedPro') : (data.error ?? t('addFailed')))
        return
      }
      if (data.source) setKSources(v => [data.source, ...v])
      if (typeof data.balance === 'number') setBalance(data.balance)
      setKUrl('')
      setKText('')
      setKName('')
    } catch {
      setKError(t('networkError'))
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
        setKError(upData.error ?? t('uploadFailed'))
        return
      }
      if (!upData.textContent) {
        setKError(t('noText'))
        return
      }
      await addKnowledge({ type: 'file', text: upData.textContent, name: upData.name })
    } catch {
      setKError(t('fileFailed'))
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
      setError(t('fillRequired', { field: missing.label }))
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
        if (res.status === 402) setError(t('insufficient', { n: data.required ?? selected.priceCredits }))
        else setError(data.error ?? t('runFailed'))
        if (typeof data.balance === 'number') setBalance(data.balance)
        return
      }
      setOutput(data.output ?? '')
      setLastCost(data.creditsSpent ?? null)
      if (typeof data.balance === 'number') setBalance(data.balance)
    } catch {
      setError(t('networkError'))
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
            {t('balance', { n: balance.toFixed(2) })}
          </div>
        )}
      </div>

      {!selected ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {skills.map(s => (
            <button key={s.id} onClick={() => openSkill(s)}
              className={cn('text-left p-4 rounded-xl border bg-white hover:shadow-sm transition-all',
                s.hasKnowledge ? 'border-amber-300 ring-1 ring-amber-100 hover:border-amber-400' : 'hover:border-indigo-400')}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {t.has(`category.${s.category}`) ? t(`category.${s.category}`) : s.category}
                </span>
                <span className="text-xs text-gray-400">{t('fromCredits', { n: s.priceCredits })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-800 text-sm">{s.label}</span>
                {s.hasKnowledge
                  ? <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">🔥 {t('ownKnowledge')}</span>
                  : <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Prompt</span>}
              </div>
              <div className="text-xs text-gray-500 mt-1 leading-relaxed">{s.description}</div>
            </button>
          ))}
          {skills.length === 0 && !error && (
            <div className="col-span-full text-center text-sm text-gray-400 py-10">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> {t('loading')}
            </div>
          )}
        </div>
      ) : (
        <div>
          <button onClick={() => setSelected(null)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
            <ArrowLeft className="h-4 w-4" /> {t('back')}
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
            {running ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('generating')}</> : t('run')}
          </Button>

          {output && (
            <div className="mt-5 border rounded-xl bg-white">
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <span className="text-xs text-gray-500">
                  {t('result')}{lastCost != null && ` ・ ${t('charged', { n: lastCost.toFixed(2) })}`}
                </span>
                <button onClick={copyOutput} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
                  {copied ? <><Check className="h-3.5 w-3.5" /> {t('copied')}</> : <><Copy className="h-3.5 w-3.5" /> {t('copy')}</>}
                </button>
              </div>
              <pre className={cn('whitespace-pre-wrap break-words text-sm text-gray-800 px-4 py-3 font-sans')}>
                {output}
              </pre>
            </div>
          )}

          {/* 內建專家「知識附掛」：訓練這位專家（PRO+） */}
          <div className="mt-6 border rounded-xl bg-white">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <BookOpen className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-semibold text-gray-800">{t('trainTitle')}</span>
              <span className="text-[11px] text-gray-400">{t('trainHint')}</span>
            </div>

            {!kCanBuild ? (
              <div className="px-4 py-4 text-sm text-gray-500">
                {t('trainLocked')}
              </div>
            ) : (
              <div className="px-4 py-4 space-y-3">
                {kSources.length > 0 && (
                  <ul className="space-y-1.5">
                    {kSources.map(s => (
                      <li key={s.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-[10px] font-medium text-gray-500 bg-white border rounded px-1.5 py-0.5">
                          {t(`srcType.${s.type}`)}
                        </span>
                        {s.source_url ? (
                          <a href={s.source_url} target="_blank" rel="noreferrer"
                            className="flex-1 truncate text-indigo-600 hover:underline">{s.name}</a>
                        ) : (
                          <span className="flex-1 truncate text-gray-700">{s.name}</span>
                        )}
                        <span className="text-[11px] text-gray-400">{t('chars', { n: s.char_count })}</span>
                        <button onClick={() => delKnowledge(s.id)} className="text-gray-400 hover:text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex gap-1 text-xs">
                  {(['url', 'text', 'file'] as const).map(k => (
                    <button key={k} onClick={() => { setKTab(k); setKError('') }}
                      className={cn('px-3 py-1.5 rounded-full border',
                        kTab === k ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white text-gray-500 hover:text-gray-800')}>
                      {t(`tab.${k}`)}
                    </button>
                  ))}
                </div>

                {kTab === 'url' && (
                  <div className="flex gap-2">
                    <Input placeholder={t('urlPh')} value={kUrl}
                      onChange={e => setKUrl(e.target.value)} />
                    <Button variant="outline" disabled={kBusy || !kUrl.trim()}
                      onClick={() => addKnowledge({ type: 'url', url: kUrl.trim() })}>
                      {kBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    </Button>
                  </div>
                )}

                {kTab === 'text' && (
                  <div className="space-y-2">
                    <Input placeholder={t('namePh')} value={kName}
                      onChange={e => setKName(e.target.value)} />
                    <Textarea rows={4} placeholder={t('textPh')} value={kText}
                      onChange={e => setKText(e.target.value)} />
                    <Button variant="outline" disabled={kBusy || !kText.trim()}
                      onClick={() => addKnowledge({ type: 'text', text: kText.trim(), name: kName.trim() })}>
                      {kBusy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('adding')}</> : <><Plus className="h-4 w-4 mr-2" /> {t('addKnowledge')}</>}
                    </Button>
                  </div>
                )}

                {kTab === 'file' && (
                  <div>
                    <input ref={fileRef} type="file" accept=".docx,.xlsx,.xls,.csv,.txt,.pdf" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) addFile(f) }} />
                    <Button variant="outline" disabled={kBusy} onClick={() => fileRef.current?.click()}>
                      {kBusy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('processing')}</> : <><Upload className="h-4 w-4 mr-2" /> {t('chooseFile')}</>}
                    </Button>
                    <p className="text-[11px] text-gray-400 mt-1.5">{t('fileHint')}</p>
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
