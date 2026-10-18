'use client'

// 門市下拉選單：選項來自 /api/inv/stores（門市資料＋已匯入資料出現過的門市）。
// 綁定單一門市的帳號鎖定不可切換；管理多家門市的帳號只列所管門市，切換時寫入 active_store cookie 讓 API 以該店為準。
import { useEffect, useState, useCallback } from 'react'

export interface StoreOption { code: string; name: string }

const COOKIE = 'active_store'

function writeActiveStore(code: string) {
  try { document.cookie = `${COOKIE}=${encodeURIComponent(code)}; path=/; max-age=31536000; samesite=lax` } catch { /* ignore */ }
}

export function useStoreOptions() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'forbidden'>('loading')
  const [options, setOptions] = useState<StoreOption[]>([])
  const [store, setStoreState] = useState('')
  const [locked, setLocked] = useState<string | null>(null)

  const apply = useCallback((res: Response, d: { store_list?: StoreOption[]; stores?: string[]; locked_store?: string | null; active_store?: string | null }) => {
    if (res.status === 401 || res.status === 403) { setStatus('forbidden'); return }
    const list: StoreOption[] = Array.isArray(d.store_list) ? d.store_list
      : (d.stores ?? []).map((code: string) => ({ code, name: '' }))
    setOptions(list)
    setLocked(d.locked_store ?? null)
    setStoreState(s => d.locked_store || (s && list.some(o => o.code === s) ? s : (d.active_store || list[0]?.code || '')))
    setStatus('ok')
  }, [])
  const load = useCallback(() => fetch('/api/inv/stores').then(async res => ({ res, d: await res.json().catch(() => ({})) })), [])
  const reload = useCallback(() => { load().then(({ res, d }) => apply(res, d)) }, [load, apply])
  useEffect(() => { load().then(({ res, d }) => apply(res, d)) }, [load, apply])

  const setStore = useCallback((code: string) => { writeActiveStore(code); setStoreState(code) }, [])
  return { status, options, store, setStore, locked, reload }
}

export function storeLabel(o: StoreOption) {
  return o.name && o.name !== o.code ? `${o.code}・${o.name}` : o.code
}

export function StoreSelect({ value, onChange, options, locked, placeholder, className }: {
  value: string; onChange: (code: string) => void; options: StoreOption[]; locked?: string | null; placeholder?: string; className?: string
}) {
  const list = value && !options.some(o => o.code === value) ? [{ code: value, name: '' }, ...options] : options
  return (
    <select
      value={value}
      disabled={!!locked}
      onChange={e => onChange(e.target.value)}
      className={`h-9 rounded-md border bg-background px-2 text-sm font-semibold disabled:bg-muted/50 disabled:cursor-not-allowed ${className ?? 'w-56'}`}
    >
      {!value && <option value="">{placeholder ?? '—'}</option>}
      {list.map(o => <option key={o.code} value={o.code}>{storeLabel(o)}</option>)}
    </select>
  )
}
