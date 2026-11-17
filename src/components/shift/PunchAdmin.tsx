'use client'

// 門市 GPS 打卡管理：設定門市打卡定位（座標＋半徑），查看每人每日上下班、工時、遲到／早退／缺卡
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, MapPin, Crosshair } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Geo { code: string; name: string; geo_lat: number | null; geo_lng: number | null; geo_radius_m: number }
interface Row {
  employee_id: string; work_date: string; name: string; firstIn: string | null; lastOut: string | null; minutes: number
  open: boolean; absent: boolean; planStart: number | null; planEnd: number | null; lateMin: number; earlyMin: number
}

const vnToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const clock = (iso: string | null, tz = 'Asia/Ho_Chi_Minh') => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: tz }) : '—')
const dur = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
const inputCls = 'h-9 px-2 rounded-md border text-sm bg-white dark:bg-gray-900'

export function PunchAdmin({ store }: { store: string }) {
  const t = useTranslations('Shift')
  const [from, setFrom] = useState(vnToday())
  const [to, setTo] = useState(vnToday())
  const [geo, setGeo] = useState<Geo | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [tz, setTz] = useState<string | undefined>(undefined)
  const [lat, setLat] = useState(''), [lng, setLng] = useState(''), [radius, setRadius] = useState('150')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick(n => n + 1), [])
  useEffect(() => {
    let alive = true
    fetch(`/api/shift/punch?store=${encodeURIComponent(store)}&from=${from}&to=${to}`)
      .then(r => (r.ok ? r.json() : { geo: null, rows: [] }))
      .then(d => {
        if (!alive) return
        setGeo(d.geo); setRows(d.rows ?? []); setTz(d.tz)
        if (d.geo) {
          setLat(d.geo.geo_lat != null ? String(d.geo.geo_lat) : '')
          setLng(d.geo.geo_lng != null ? String(d.geo.geo_lng) : '')
          setRadius(String(d.geo.geo_radius_m ?? 150))
        }
      }).catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [store, from, to, tick])

  function useHere() {
    setMsg('')
    if (!navigator.geolocation) { setMsg(t('punchNoGeo')); return }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(p => {
      setBusy(false)
      setLat(p.coords.latitude.toFixed(6)); setLng(p.coords.longitude.toFixed(6))
      setMsg(t('punchGotHere', { acc: Math.round(p.coords.accuracy) }))
    }, () => { setBusy(false); setMsg(t('punchNoGeo')) }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
  }

  async function save(clear = false) {
    setMsg('')
    const r = await fetch('/api/shift/punch', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clear ? { store, lat: null, lng: null, radius: Number(radius) || 150 } : { store, lat: Number(lat), lng: Number(lng), radius: Number(radius) }),
    })
    const d = await r.json().catch(() => ({}))
    setMsg(r.ok ? t('punchSaved') : (d.error || t('loadFailed')))
    if (r.ok) load()
  }

  const ready = geo?.geo_lat != null && geo?.geo_lng != null
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" />{t('punchGeoTitle')}</h2>
        <p className="text-xs text-gray-500">{t('punchGeoHint')}</p>
        {!geo ? <p className="text-sm text-amber-700">{t('punchNoStore')}</p> : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1"><span className="block text-xs text-gray-500">{t('punchLat')}</span><input className={`${inputCls} w-32`} value={lat} onChange={e => setLat(e.target.value)} inputMode="decimal" /></label>
              <label className="space-y-1"><span className="block text-xs text-gray-500">{t('punchLng')}</span><input className={`${inputCls} w-32`} value={lng} onChange={e => setLng(e.target.value)} inputMode="decimal" /></label>
              <label className="space-y-1"><span className="block text-xs text-gray-500">{t('punchRadius')}</span><input className={`${inputCls} w-24`} value={radius} onChange={e => setRadius(e.target.value)} inputMode="numeric" /></label>
              <Button variant="outline" size="sm" onClick={useHere} disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}{t('punchUseHere')}
              </Button>
              <Button size="sm" onClick={() => save()} disabled={!lat || !lng}>{t('punchSave')}</Button>
              {ready && <Button variant="ghost" size="sm" onClick={() => save(true)}>{t('punchClear')}</Button>}
            </div>
            <div className="text-xs flex flex-wrap gap-3">
              <span className={ready ? 'text-emerald-700' : 'text-amber-700'}>{ready ? t('punchReady') : t('punchNotReady')}</span>
              {ready && <a className="text-indigo-600 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${geo.geo_lat},${geo.geo_lng}`}>{t('punchOpenMap')}</a>}
            </div>
          </>
        )}
        {msg && <p className="text-sm text-gray-700 dark:text-gray-300">{msg}</p>}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <h2 className="font-semibold mr-auto">{t('punchRecords')}</h2>
          <input type="date" className={inputCls} value={from} onChange={e => setFrom(e.target.value)} />
          <span className="text-gray-400">–</span>
          <input type="date" className={inputCls} value={to} onChange={e => setTo(e.target.value)} />
        </div>
        {!rows ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          : rows.length === 0 ? <p className="text-sm text-gray-400">{t('punchEmpty')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-1.5 pr-2">{t('punchDate')}</th><th className="pr-2">{t('punchName')}</th><th className="pr-2">{t('punchPlan')}</th>
                  <th className="pr-2">{t('punchIn')}</th><th className="pr-2">{t('punchOut')}</th><th className="pr-2">{t('punchHours')}</th><th>{t('punchStatus')}</th>
                </tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={`${r.employee_id}|${r.work_date}`} className="border-b last:border-0">
                      <td className="py-1.5 pr-2 whitespace-nowrap">{r.work_date.slice(5)}</td>
                      <td className="pr-2">{r.name}</td>
                      <td className="pr-2 whitespace-nowrap">{r.planStart != null && r.planEnd != null ? `${hhmm(r.planStart)}–${hhmm(r.planEnd)}` : '—'}</td>
                      <td className="pr-2">{clock(r.firstIn, tz)}</td>
                      <td className="pr-2">{r.open ? '…' : clock(r.lastOut, tz)}</td>
                      <td className="pr-2">{r.minutes ? dur(r.minutes) : '—'}</td>
                      <td className="space-x-1 whitespace-nowrap">
                        {r.absent && <span className="text-rose-600">{t('punchAbsent')}</span>}
                        {r.lateMin > 0 && <span className="text-rose-600">{t('punchLate', { m: r.lateMin })}</span>}
                        {r.earlyMin > 0 && <span className="text-orange-600">{t('punchEarly', { m: r.earlyMin })}</span>}
                        {r.open && <span className="text-amber-600">{t('punchOpen')}</span>}
                        {!r.absent && !r.open && !r.lateMin && !r.earlyMin && <span className="text-emerald-600">{t('punchOk')}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        <p className="text-xs text-gray-500">{t('punchAttendanceHint')}</p>
      </Card>
    </div>
  )
}
