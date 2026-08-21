'use client'

import { useState, useEffect, use } from 'react'

interface VStore { code: string; name: string; region: string }
const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')

export default function VendorFillPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [vendor, setVendor] = useState<{ name: string; service: string } | null>(null)
  const [category, setCategory] = useState<{ code: string; name: string } | null>(null)
  const [stores, setStores] = useState<VStore[]>([])
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true); setSaved(false)
    fetch(`/api/fin/vendor/${token}?year=${year}&month=${month}`).then(r => (r.ok ? r.json() : null)).then(d => {
      if (!alive) return
      if (!d) { setNotFound(true); setLoading(false); return }
      setVendor(d.vendor); setCategory(d.category); setStores(d.stores ?? [])
      setAmounts(d.amounts ?? {})
      setLoading(false)
    })
    return () => { alive = false }
  }, [token, year, month])

  const submit = async () => {
    setSaving(true)
    const res = await fetch(`/api/fin/vendor/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year, month, amounts }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    else alert((await res.json().catch(() => ({}))).error ?? '送出失敗')
  }

  if (loading) return <Center>載入中…</Center>
  if (notFound || !vendor) return <Center>連結無效或已停用</Center>

  const total = stores.reduce((s, st) => s + (amounts[st.code] || 0), 0)
  const byRegion: Record<string, VStore[]> = {}
  for (const st of stores) (byRegion[st.region || '（未分區）'] ??= []).push(st)

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 520, display: 'grid', gap: 16 }}>
        <div style={card}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{vendor.name}　費用填報</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {vendor.service === 'gas' ? '瓦斯' : '冰塊'}{category ? `・${category.name}` : ''}。請選月份，填各門市金額後送出。
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={sel}>{[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y} 年</option>)}</select>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={sel}>{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m} 月</option>)}</select>
          </div>
        </div>

        {!category && <div style={{ ...card, color: '#b45309', fontSize: 13 }}>後台尚未設定對應費用科目，暫時無法填報，請聯繫店家。</div>}
        {stores.length === 0 && category && <div style={{ ...card, color: '#64748b', fontSize: 13 }}>目前沒有您涵蓋的門市。</div>}

        {Object.entries(byRegion).map(([region, list]) => (
          <div key={region} style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>{region}</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {list.map(st => (
                <div key={st.code} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 14 }}>{st.name || st.code} <span style={{ color: '#94a3b8', fontSize: 12 }}>{st.code}</span></span>
                  <input type="number" inputMode="numeric" value={amounts[st.code] ?? ''} disabled={!category}
                    onChange={e => setAmounts(p => ({ ...p, [st.code]: Number(e.target.value) || 0 }))}
                    style={{ width: 140, height: 38, borderRadius: 8, border: '1px solid #e2e8f0', padding: '0 10px', textAlign: 'right', fontSize: 14 }} placeholder="金額" />
                </div>
              ))}
            </div>
          </div>
        ))}

        {category && stores.length > 0 && (
          <div style={{ ...card, position: 'sticky', bottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: '#475569' }}>合計 <b style={{ fontSize: 18 }}>{fmt(total)}</b></span>
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
const sel: React.CSSProperties = { height: 38, borderRadius: 8, border: '1px solid #e2e8f0', padding: '0 10px', fontSize: 14 }
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 15 }}>{children}</div>
}
