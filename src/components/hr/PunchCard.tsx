'use client'

// 員工 GPS 打卡卡片：員工專區（api=/api/e/<打卡編號>）與 ERP 登入打卡（api=/api/me）共用，呼叫 ${api}/punch
import { useCallback, useEffect, useState } from 'react'
import { Loader2, MapPin, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'

const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const wd = (d: string) => WD[new Date(d + 'T00:00:00Z').getUTCDay()] ?? ''

// 手機 GPS 打卡：取得目前位置送到伺服器，伺服器判斷是否在門市範圍內及上班／下班
interface PunchDay { work_date: string; firstIn: string | null; lastOut: string | null; minutes: number; open: boolean; planStart: number | null; planEnd: number | null; lateMin: number; earlyMin: number }
interface PunchInfo { today: string; tz?: string; next: 'in' | 'out'; punches: { id: string; kind: 'in' | 'out'; punched_at: string; distance_m: number | null }[]; days: PunchDay[]; stores: { code: string; name: string; ready: boolean; radius: number }[] }
const clock = (iso: string | null, tz = 'Asia/Ho_Chi_Minh') => (iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: tz }) : '—')
const dur = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`

export function PunchCard({ api }: { api: string }) {
  const [info, setInfo] = useState<PunchInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick(n => n + 1), [])
  useEffect(() => {
    let alive = true
    fetch(`${api}/punch`).then(r => (r.ok ? r.json() : null)).then(d => { if (alive) setInfo(d) }).catch(() => {})
    return () => { alive = false }
  }, [api, tick])

  function punch() {
    setMsg(null)
    if (!navigator.geolocation) { setMsg({ ok: false, text: 'Thiết bị không hỗ trợ định vị / 此裝置不支援定位' }); return }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(async pos => {
      const r = await fetch(`${api}/punch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }) })
      const d = await r.json().catch(() => ({}))
      setBusy(false)
      if (!r.ok) { setMsg({ ok: false, text: d.error || 'Lỗi / 打卡失敗' }); return }
      setMsg({ ok: true, text: `${d.kind === 'in' ? 'Vào ca / 上班' : 'Tan ca / 下班'} ✓ ${d.store}（${d.distance}m）` })
      load()
    }, err => {
      setBusy(false)
      setMsg({ ok: false, text: err.code === err.PERMISSION_DENIED
        ? 'Hãy cho phép truy cập vị trí trong trình duyệt / 請在瀏覽器允許使用位置資訊'
        : 'Không lấy được vị trí, thử lại / 無法取得定位，請再試一次' })
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
  }

  if (!info) return <Card className="p-5"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></Card>
  const ready = info.stores.some(s => s.ready)
  const isIn = info.next === 'in'
  return (
    <Card className="p-5 space-y-3">
      <h2 className="font-bold flex items-center gap-2"><MapPin className="h-4 w-4" /> Chấm công / 打卡</h2>
      {!ready ? (
        <p className="text-sm text-amber-700">Cửa hàng chưa cài đặt vị trí chấm công / 門市尚未設定打卡定位，請聯絡店長</p>
      ) : (
        <button onClick={punch} disabled={busy}
          className={`w-full h-16 rounded-2xl text-white text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-60 ${isIn ? 'bg-emerald-600' : 'bg-orange-500'}`}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clock className="h-5 w-5" />}
          {isIn ? 'Vào ca / 上班打卡' : 'Tan ca / 下班打卡'}
        </button>
      )}
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg.text}</p>}
      {info.punches.length > 0 && (
        <div className="text-sm divide-y">
          {info.punches.map(p => (
            <div key={p.id} className="flex justify-between py-1.5">
              <span>{p.kind === 'in' ? 'Vào ca / 上班' : 'Tan ca / 下班'}</span><b>{clock(p.punched_at, info.tz)}</b>
            </div>
          ))}
        </div>
      )}
      {info.days.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-500">7 ngày gần đây / 近 7 天</summary>
          <div className="divide-y mt-1">
            {info.days.map(d => (
              <div key={d.work_date} className="py-1.5 flex flex-wrap items-center gap-x-3">
                <span className="w-20">{d.work_date.slice(5)} ({wd(d.work_date)})</span>
                <span>{clock(d.firstIn, info.tz)}–{d.open ? '…' : clock(d.lastOut, info.tz)}</span>
                <b>{dur(d.minutes)}</b>
                {d.lateMin > 0 && <span className="text-rose-600">Trễ / 遲到 {d.lateMin}′</span>}
                {d.earlyMin > 0 && <span className="text-orange-600">Về sớm / 早退 {d.earlyMin}′</span>}
              </div>
            ))}
          </div>
        </details>
      )}
    </Card>
  )
}

