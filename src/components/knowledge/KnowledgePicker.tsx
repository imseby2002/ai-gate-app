'use client'

// 公司知識庫選擇器：給 AI 助理、專家、短影音腳本等模組勾選要引用的知識文件
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { BookOpen, Loader2 } from 'lucide-react'
import { getLocalizedDepartments } from '@/lib/org-units'

export interface KnowledgeDocMeta {
  id: string
  department: string
  title: string
  char_count: number
}

interface Props {
  value: string[]
  onChange: (ids: string[]) => void
  /** 單選模式：點選後立即回傳（例如「從知識庫匯入」） */
  single?: boolean
  className?: string
}

export function useKnowledgeDocs() {
  const [docs, setDocs] = useState<KnowledgeDocMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    let alive = true
    fetch('/api/knowledge')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive) return
        if (!d) { setUnavailable(true); return }
        setDocs(d.docs ?? [])
      })
      .catch(() => { if (alive) setUnavailable(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])
  return { docs, loading, unavailable }
}

export default function KnowledgePicker({ value, onChange, single, className }: Props) {
  const t = useTranslations('KnowledgePicker')
  const locale = useLocale()
  const depts = useMemo(() => getLocalizedDepartments(locale), [locale])
  const deptLabel = (k: string) => {
    const d = depts.find(x => x.key === k)
    return d ? `${d.icon} ${d.label}` : k
  }
  const { docs, loading, unavailable } = useKnowledgeDocs()
  const [filter, setFilter] = useState('')

  if (loading) return <div className={`text-xs text-muted-foreground flex items-center gap-1 ${className ?? ''}`}><Loader2 className="h-3 w-3 animate-spin" />{t('loading')}</div>
  if (unavailable) return <div className={`text-xs text-muted-foreground ${className ?? ''}`}>{t('unavailable')}</div>
  if (!docs.length) {
    return (
      <div className={`text-xs text-muted-foreground ${className ?? ''}`}>
        {t('empty')} <Link href="/knowledge" className="underline" target="_blank">{t('manage')}</Link>
      </div>
    )
  }

  const usedDepts = depts.filter(d => docs.some(x => x.department === d.key)).map(d => d.key)
  const shown = filter ? docs.filter(d => d.department === filter) : docs
  const toggle = (id: string) => {
    if (single) { onChange([id]); return }
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
  }

  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <button type="button" onClick={() => setFilter('')} className={`px-2 py-0.5 rounded border ${!filter ? 'bg-primary text-primary-foreground' : ''}`}>{t('all')}</button>
        {usedDepts.map(k => (
          <button type="button" key={k} onClick={() => setFilter(k)} className={`px-2 py-0.5 rounded border ${filter === k ? 'bg-primary text-primary-foreground' : ''}`}>{deptLabel(k)}</button>
        ))}
        {!single && value.length > 0 && <span className="ml-auto text-muted-foreground">{t('selected', { n: value.length })}</span>}
      </div>
      <div className="max-h-56 overflow-y-auto rounded border divide-y">
        {shown.map(d => (
          <label key={d.id} className="flex items-start gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/50">
            <input type={single ? 'radio' : 'checkbox'} className="mt-1" checked={value.includes(d.id)} onChange={() => toggle(d.id)} />
            <span className="min-w-0">
              <span className="block truncate">{d.title}</span>
              <span className="block text-xs text-muted-foreground">{deptLabel(d.department)} · {t('chars', { n: d.char_count.toLocaleString() })}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
