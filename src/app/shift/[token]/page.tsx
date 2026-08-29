'use client'

import { useState, useEffect, use } from 'react'

interface Slot { code: string; label: string }
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
const wd = (d: string) => WEEKDAY[new Date(d + 'T00:00:00Z').getUTCDay()] ?? ''

export default function ShiftFillPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [name, setName] = useState('')
  const [period, setPeriod] = useState<{ title: string; store: string; start_date: string; end_date: string; slots: Slot[]; status: string } | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/shift/fill/${token}`).then(r => (r.ok ? r.json() : null)).then(d => {
      if (!alive) return
      if (!d) { setNotFound(true); setLoading(false); return }
      setName(d.employee_name ?? ''); setPeriod(d.period); setDates(d.dates ?? [])
      setSel(new Set<string>(d.selected ?? [])); setLoading(false)
    })
    return () => { alive = false }
  }, [token])

  const toggle = (key: string) => setSel(p => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n })
  const rowAll = (date: string, slots: Slot[]) => setSel(p => {
    const n = new Set(p)
    const keys = slots.map(s => `${date}|${s.code}`)
    const allOn = keys.every(k => n.has(k))
    for (const k of keys) allOn ? n.delete(k) : n.add(k)
    return n
  })

  const submit = async () => {
    setSaving(true)
    const res = await fetch(`/api/shift/fill/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selected: [...sel] }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    else alert((await res.json().catch(() => ({}))).error ?? '送出失敗')
  }

  if (loading) return <Center>載入中…</Center>
  if (notFound || !period) return <Center>連結無效</Center>
  const slots = period.slots ?? []
  const locked = period.status === 'confirmed'

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'grid', gap: 16 }}>
        <div style={card}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{name}　可上班時段</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {period.title || period.store}：{period.start_date} ~ {period.end_date}。勾選你可以上班的日期與時段後送出。
          </p>
          {locked && <p style={{ fontSize: 13, color: '#b45309', marginTop: 6 }}>此排班已確認，無法再修改。</p>}
        </div>

        <div style={card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b' }}>日期</th>
                  {slots.map(s => <th key={s.code} style={{ padding: '6px 8px', color: '#64748b' }}>{s.label}</th>)}
                  <th style={{ padding: '6px 8px' }} />
                </tr>
              </thead>
              <tbody>
                {dates.map(d => (
                  <tr key={d} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{d.slice(5)} <span style={{ color: '#94a3b8' }}>({wd(d)})</span></td>
                    {slots.map(s => {
                      const key = `${d}|${s.code}`
                      const on = sel.has(key)
                      return (
                        <td key={s.code} style={{ textAlign: 'center', padding: '4px 8px' }}>
                          <button disabled={locked} onClick={() => toggle(key)}
                            style={{ width: 34, height: 34, borderRadius: 8, cursor: locked ? 'default' : 'pointer',
                              border: on ? '1px solid #2563eb' : '1px solid #e2e8f0', background: on ? '#2563eb' : 'white', color: on ? 'white' : '#cbd5e1', fontSize: 16 }}>
                            {on ? '✓' : ''}
                          </button>
                        </td>
                      )
                    })}
                    <td style={{ textAlign: 'center' }}>
                      <button disabled={locked} onClick={() => rowAll(d, slots)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: locked ? 'default' : 'pointer' }}>全天</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {!locked && (
          <div style={{ ...card, position: 'sticky', bottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: '#475569' }}>已選 <b style={{ fontSize: 18 }}>{sel.size}</b> 格</span>
              <button onClick={submit} disabled={saving}
                style={{ height: 42, padding: '0 24px', borderRadius: 10, border: 'none', background: saved ? '#10b981' : '#2563eb', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? '送出中…' : saved ? '已送出 ✓' : '送出'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const card: React.CSSProperties = { background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 15 }}>{children}</div>
}
