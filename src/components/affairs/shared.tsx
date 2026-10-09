'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

export const selectCls = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm'
export const textareaCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px]'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 各資料表欄位不同，由各分頁自行解讀
export type Row = Record<string, any> & { id: string }

// 讀寫 /api/affairs/records/[kind]
export function useRecords<T extends Row>(kind: string, query = '') {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/affairs/records/${kind}${query ? `?${query}` : ''}`)
    const d = await res.json().catch(() => ({}))
    if (res.ok) { setItems(d.items ?? []); setError('') } else setError(d.error ?? res.statusText)
    setLoading(false)
  }, [kind, query])

  useEffect(() => { reload() }, [reload])

  const save = async (row: Partial<T>): Promise<string | null> => {
    const res = await fetch(`/api/affairs/records/${kind}`, {
      method: row.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return d.error ?? res.statusText
    await reload()
    return null
  }

  const saveMany = async (rows: Partial<T>[]): Promise<string | null> => {
    const res = await fetch(`/api/affairs/records/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: rows }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return d.error ?? res.statusText
    await reload()
    return null
  }

  const remove = async (id: string) => {
    await fetch(`/api/affairs/records/${kind}?id=${id}`, { method: 'DELETE' })
    await reload()
  }

  return { items, loading, error, reload, save, saveMany, remove }
}

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className={`bg-card rounded-xl shadow-xl w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} my-4`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

export function Chips<K extends string>({ value, options, onChange }: { value: K; options: [K, string][]; onChange: (v: K) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${value === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

export const fmtNum = (n: unknown, locale?: string) =>
  n === null || n === undefined || n === '' || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString(locale)

export const todayStr = () => new Date().toISOString().slice(0, 10)
