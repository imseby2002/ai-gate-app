'use client'

// 員工專區：<公司子網域>/e/<打卡編號>。首次以生日（DDMMYYYY）登入並設定自己的密碼，之後用密碼登入。
import { useCallback, useEffect, useRef, useState, use } from 'react'
import Link from 'next/link'
import { Loader2, LogOut, KeyRound, FileText, CheckCircle2, CalendarDays, Upload, Paperclip, Trash2, Clock, UserRound, Lock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SLOT_MIN } from '@/lib/shift/time'
import type { ReactNode } from 'react'

interface Me {
  name: string
  company: string
  hasPin: boolean
  payslips: { id: string; year: number; month: number; net_pay: number; payslip_confirmed: boolean }[]
}

const input = 'w-full h-11 px-3 rounded-xl border text-base outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

export default function EmployeePortalPage({ params }: { params: Promise<{ no: string }> }) {
  const { no } = use(params)
  const api = `/api/e/${encodeURIComponent(no)}`
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [secret, setSecret] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [changing, setChanging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const r = await fetch(`${api}/me`)
    setMe(r.ok ? await r.json() : null)
    setLoading(false)
  }, [api])

  useEffect(() => { load() }, [load])

  async function login() {
    setBusy(true); setErr('')
    const r = await fetch(`${api}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(d.error ?? 'Đăng nhập thất bại'); return }
    setSecret('')
    await load()
  }

  async function savePin() {
    if (pin !== pin2) { setErr('Hai lần nhập không khớp / 兩次輸入不一致'); return }
    setBusy(true); setErr('')
    const r = await fetch(`${api}/pin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(d.error ?? 'Lưu thất bại'); return }
    setPin(''); setPin2(''); setChanging(false)
    await load()
  }

  async function logout() {
    await fetch(`${api}/login`, { method: 'DELETE' })
    setMe(null)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 md:py-10 px-3 md:px-6 flex justify-center">
      <div className={`w-full space-y-4 ${me?.hasPin && !changing ? 'max-w-md md:max-w-6xl' : 'max-w-md'}`}>
        {!me ? (
          <Card className="p-6 space-y-4">
            <div>
              <h1 className="text-xl font-bold">Trang nhân viên / 員工專區</h1>
              <p className="text-sm text-slate-500">Mã chấm công / 打卡編號：<b>{decodeURIComponent(no)}</b></p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mật khẩu hoặc ngày sinh (DDMMYYYY) / 密碼或生日</label>
              <input
                type="password" inputMode="text" autoComplete="current-password" className={input}
                value={secret} onChange={e => setSecret(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()}
                placeholder="VD: 15081995"
              />
              <p className="text-xs text-slate-500">Lần đầu dùng ngày sinh, ví dụ 15/08/1995 → 15081995, hoặc mật khẩu tạm do nhân sự cấp. 第一次請用生日或人事給的臨時密碼登入。</p>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <Button onClick={login} disabled={busy || !secret} className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Đăng nhập / 登入'}
            </Button>
          </Card>
        ) : !me.hasPin || changing ? (
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-indigo-600" />
              <h1 className="text-lg font-bold">{me.hasPin ? 'Đổi mật khẩu / 變更密碼' : 'Đặt mật khẩu của bạn / 設定您的密碼'}</h1>
            </div>
            {!me.hasPin && <p className="text-sm text-slate-600">Xin chào {me.name}. Vui lòng đặt mật khẩu riêng (ít nhất 6 ký tự). Sau này đăng nhập bằng mật khẩu này. 請設定自己的密碼（至少 6 碼），之後改用密碼登入。</p>}
            <input type="password" autoComplete="new-password" className={input} value={pin} onChange={e => setPin(e.target.value)} placeholder="Mật khẩu mới / 新密碼" />
            <input type="password" autoComplete="new-password" className={input} value={pin2} onChange={e => setPin2(e.target.value)} placeholder="Nhập lại / 再輸入一次" />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <Button onClick={savePin} disabled={busy || pin.length < 6} className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Lưu / 儲存'}
            </Button>
            {me.hasPin && <button onClick={() => { setChanging(false); setErr('') }} className="w-full text-sm text-slate-500">Hủy / 取消</button>}
          </Card>
        ) : (
          <>
            <Card className="p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">{me.company}</div>
                <div className="text-lg font-bold">{me.name}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setChanging(true)} className="p-2 rounded-lg border" title="Đổi mật khẩu / 變更密碼"><KeyRound className="h-4 w-4" /></button>
                <button onClick={logout} className="p-2 rounded-lg border" title="Đăng xuất / 登出"><LogOut className="h-4 w-4" /></button>
              </div>
            </Card>
            <PortalBody api={api}>
                <Card className="p-5 space-y-2">
                  <h2 className="font-bold flex items-center gap-2"><FileText className="h-4 w-4" /> Phiếu lương / 薪資條</h2>
                  {me.payslips.length === 0 && <p className="text-sm text-slate-500">Chưa có phiếu lương / 尚無薪資條</p>}
                  <div className="divide-y">
                    {me.payslips.map(p => (
                      <Link key={p.id} href={`/e/${encodeURIComponent(no)}/payslip/${p.id}`} className="flex items-center justify-between py-3 text-sm">
                        <span>Tháng {p.month}/{p.year}</span>
                        <span className="flex items-center gap-2">
                          <b>{Math.round(Number(p.net_pay) || 0).toLocaleString('vi-VN')} VND</b>
                          {p.payslip_confirmed && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                        </span>
                      </Link>
                    ))}
                  </div>
                </Card>
            </PortalBody>
          </>
        )}
      </div>
    </div>
  )
}

interface AvailRuleRow { id: string; start_date: string; end_date: string; weekdays: number[]; start_min: number; end_min: number; note: string }
interface MyPlan { id: string; store: string; work_date: string; start_min: number; end_min: number }
interface ShiftData { store: string | null; kind: 'fulltime' | 'parttime'; rules: AvailRuleRow[]; plans: MyPlan[]; dayoffs: { id: string; off_date: string }[] }
type Range = { start: number; end: number }

const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const WD_ZH = ['日', '一', '二', '三', '四', '五', '六']
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_START = 6 * 60, DAY_END = 24 * 60
const SLOTS = Array.from({ length: (DAY_END - DAY_START) / SLOT_MIN }, (_, i) => DAY_START + i * SLOT_MIN)
const wdNum = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay()
const wd = (d: string) => WD[wdNum(d)] ?? ''
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
const addDay = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const isSingleDay = (r: AvailRuleRow) => r.start_date === r.end_date
const ruleOn = (r: AvailRuleRow, d: string) => r.start_date <= d && r.end_date >= d && (!r.weekdays?.length || r.weekdays.includes(wdNum(d)))

// 已選格子 → 連續時段
function toRanges(slots: Set<number>): Range[] {
  const out: Range[] = []
  for (const m of [...slots].sort((a, b) => a - b)) {
    const last = out[out.length - 1]
    if (last && last.end === m) last.end = m + SLOT_MIN
    else out.push({ start: m, end: m + SLOT_MIN })
  }
  return out
}
function merge(list: Range[]): Range[] {
  const s = [...list].sort((a, b) => a.start - b.start), out: Range[] = []
  for (const r of s) {
    const last = out[out.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else out.push({ ...r })
  }
  return out
}
const rangesText = (rs: Range[]) => rs.map(r => `${hhmm(r.start)}–${hhmm(r.end)}`).join('、')

// 登入後主體：手機單欄，電腦雙欄（左：薪資條、班表、文件；右：可上班時段／期待休假日）
function PortalBody({ api, children }: { api: string; children: ReactNode }) {
  const [data, setData] = useState<ShiftData | null>(null)
  const load = useCallback(async () => {
    const r = await fetch(`${api}/shifts`)
    setData(r.ok ? await r.json() : null)
  }, [api])
  useEffect(() => { load() }, [load])
  // 手機單欄（薪資條、班表 → 可上班時段 → 履歷、文件）；電腦雙欄（右欄為時段）。純 CSS，切換時不重新掛載
  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:grid-rows-[auto_1fr] md:items-start">
      <div className="space-y-4 md:col-start-1 md:row-start-1">
        {children}
        {data && <ScheduleCard plans={data.plans} />}
      </div>
      <div className="space-y-4 md:col-start-2 md:row-start-1 md:row-span-2">
        {data && !data.store && (
          <Card className="p-5"><p className="text-sm text-amber-700">Chưa có cửa hàng, vui lòng liên hệ nhân sự để được xếp ca. / 尚未設定門市，請聯絡人事後才能排班。</p></Card>
        )}
        {data?.store && data.kind === 'fulltime' && <DayOffCard api={api} dayoffs={data.dayoffs} onChanged={load} />}
        {data?.store && data.kind === 'parttime' && <AvailCard api={api} rules={data.rules} onChanged={load} />}
      </div>
      <div className="space-y-4 md:col-start-1 md:row-start-2">
        <ProfileCard api={api} />
        <DocsCard api={api} />
      </div>
    </div>
  )
}

function ScheduleCard({ plans }: { plans: MyPlan[] }) {
  return (
    <Card className="p-5 space-y-3">
      <h2 className="font-bold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Lịch làm của tôi / 我的班表</h2>
      {plans.length === 0 && <p className="text-sm text-slate-500">Chưa có lịch / 尚無已發布的班表</p>}
      <div className="divide-y text-sm">
        {plans.map(p => (
          <div key={p.id} className="flex justify-between py-2">
            <span>{p.work_date.slice(5)} ({wd(p.work_date)})</span>
            <b>{hhmm(p.start_min)} – {hhmm(p.end_min)}</b>
          </div>
        ))}
      </div>
    </Card>
  )
}

// 06:00–24:00 時段條（顯示用）
function DayBar({ ranges }: { ranges: Range[] }) {
  const pct = (m: number) => ((m - DAY_START) / (DAY_END - DAY_START)) * 100
  return (
    <div className="relative h-4 rounded bg-slate-100 overflow-hidden">
      {[12, 18].map(h => <div key={h} className="absolute top-0 bottom-0 w-px bg-slate-300" style={{ left: `${pct(h * 60)}%` }} />)}
      {ranges.map((r, i) => (
        <div key={i} className="absolute top-0 bottom-0 bg-emerald-500" style={{ left: `${pct(Math.max(r.start, DAY_START))}%`, width: `${pct(Math.min(r.end, DAY_END)) - pct(Math.max(r.start, DAY_START))}%` }} />
      ))}
    </div>
  )
}

// 點選／拖曳選取 06:00–24:00 的半小時格子
function SlotPicker({ value, onChange }: { value: Set<number>; onChange: React.Dispatch<React.SetStateAction<Set<number>>> }) {
  const paint = useRef<{ on: boolean; mode: boolean }>({ on: false, mode: true })
  const slotAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const v = el?.closest('[data-slot]')?.getAttribute('data-slot')
    return v == null ? null : Number(v)
  }
  const apply = (m: number) => onChange(prev => {
    if (prev.has(m) === paint.current.mode) return prev
    const n = new Set(prev)
    if (paint.current.mode) n.add(m); else n.delete(m)
    return n
  })
  const ranges = toRanges(value)
  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-500">Bấm hoặc kéo để chọn giờ (mỗi ô {SLOT_MIN} phút) / 點選或拖曳選擇時段（每格 {SLOT_MIN} 分鐘）</div>
      <div
        className="grid grid-cols-4 sm:grid-cols-6 gap-1 select-none touch-none"
        onPointerDown={e => {
          const m = slotAt(e.clientX, e.clientY)
          if (m == null) return
          paint.current = { on: true, mode: !value.has(m) }
          apply(m)
        }}
        onPointerMove={e => { if (paint.current.on) { const m = slotAt(e.clientX, e.clientY); if (m != null) apply(m) } }}
        onPointerUp={() => { paint.current.on = false }}
        onPointerCancel={() => { paint.current.on = false }}
        onPointerLeave={() => { paint.current.on = false }}
      >
        {SLOTS.map(m => (
          <div key={m} data-slot={m}
            className={`h-9 rounded-md border text-xs flex items-center justify-center cursor-pointer ${value.has(m) ? 'bg-emerald-500 border-emerald-500 text-white font-semibold' : 'bg-white text-slate-600'} ${m % 60 === 0 ? '' : 'opacity-90'}`}>
            {hhmm(m)}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-600">{ranges.length ? rangesText(ranges) : 'Chưa chọn / 尚未選擇'}</span>
        {value.size > 0 && <button type="button" onClick={() => onChange(new Set())} className="text-slate-500 underline shrink-0">Xóa chọn / 清除</button>}
      </div>
    </div>
  )
}

// 月曆多選日期（今天起約 3 個月）
function MultiDateCalendar({ value, onChange }: { value: Set<string>; onChange: (s: Set<string>) => void }) {
  const [offset, setOffset] = useState(0)
  const t0 = today(), limit = addDay(t0, 92)
  const base = new Date(t0 + 'T00:00:00Z')
  const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1))
  const y = first.getUTCFullYear(), m = first.getUTCMonth()
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const lead = (first.getUTCDay() + 6) % 7
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(Date.UTC(y, m, i + 1)).toISOString().slice(0, 10))]
  const toggle = (d: string) => { const n = new Set(value); if (n.has(d)) n.delete(d); else n.add(d); onChange(n) }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0} className="px-3 py-1 rounded-lg border disabled:opacity-30">‹</button>
        <b className="text-sm">{m + 1}/{y}</b>
        <button type="button" onClick={() => setOffset(o => Math.min(3, o + 1))} disabled={offset === 3} className="px-3 py-1 rounded-lg border disabled:opacity-30">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WD_ORDER.map(n => <div key={n} className="text-[11px] text-slate-400">{WD[n]}<br />{WD_ZH[n]}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const on = value.has(d), disabled = d < t0 || d > limit
          return (
            <button type="button" key={d} disabled={disabled} onClick={() => toggle(d)}
              className={`h-9 rounded-lg text-sm ${on ? 'bg-indigo-600 text-white font-bold' : disabled ? 'text-slate-300' : 'bg-white border'}`}>
              {Number(d.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// 工讀：可上班時段（指定日期 或 每週固定）＋未來每天的時段總覽
function AvailCard({ api, rules, onChanged }: { api: string; rules: AvailRuleRow[]; onChanged: () => void }) {
  const [mode, setMode] = useState<'dates' | 'weekly' | null>(null)
  const [dates, setDates] = useState<Set<string>>(new Set())
  const [slots, setSlots] = useState<Set<number>>(new Set())
  const [wk, setWk] = useState({ start_date: today(), end_date: addDay(today(), 27), weekdays: [] as number[] })
  const [span, setSpan] = useState(14)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const t0 = today()
  const upcoming = Array.from({ length: span }, (_, i) => addDay(t0, i))
  const weekly = rules.filter(r => !isSingleDay(r))
  const daySingles = (d: string) => rules.filter(r => isSingleDay(r) && r.start_date === d)

  function open(m: 'dates' | 'weekly', d?: string) {
    setMode(m); setMsg('')
    if (m === 'dates' && d) {
      setDates(new Set([d]))
      const s = new Set<number>()
      for (const r of daySingles(d)) for (const x of SLOTS) if (x >= r.start_min && x + SLOT_MIN <= r.end_min) s.add(x)
      setSlots(s)
    } else { setDates(new Set()); setSlots(new Set()) }
  }
  async function save() {
    const ranges = toRanges(slots).map(r => ({ start: hhmm(r.start), end: hhmm(r.end) }))
    setBusy(true); setMsg('')
    const r = mode === 'dates'
      ? await fetch(`${api}/shifts`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dates: [...dates], ranges }) })
      : await fetch(`${api}/shifts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...wk, ranges }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(j.error ?? 'Lưu thất bại / 儲存失敗'); return }
    setMode(null)
    onChanged()
  }
  async function remove(id: string) {
    if (!confirm('Xóa? / 刪除這筆？')) return
    await fetch(`${api}/shifts`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    onChanged()
  }
  const wdText = (w: number[]) => !w?.length || w.length === 7 ? 'Mỗi ngày / 每天' : WD_ORDER.filter(n => w.includes(n)).map(n => `${WD[n]}/${WD_ZH[n]}`).join(' ')
  const toggleWd = (n: number) => setWk(p => ({ ...p, weekdays: p.weekdays.includes(n) ? p.weekdays.filter(x => x !== n) : [...p.weekdays, n] }))
  const canSave = mode === 'dates' ? dates.size > 0 : slots.size > 0

  return (
    <Card className="p-5 space-y-4">
      <div className="space-y-1">
        <h2 className="font-bold flex items-center gap-2"><Clock className="h-4 w-4" /> Thời gian có thể làm / 可上班時段</h2>
        <p className="text-xs text-slate-500">Chọn ngày rồi bấm các ô giờ 06:00–24:00. 選日期後點選 06:00–24:00 的時段；也可設定每週固定時段。</p>
      </div>

      {!mode && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => open('dates')} className="h-11 rounded-xl bg-indigo-600 text-white text-sm font-semibold">+ Chọn ngày / 選日期</button>
          <button onClick={() => open('weekly')} className="h-11 rounded-xl border text-indigo-700 text-sm font-semibold">+ Hằng tuần / 每週固定</button>
        </div>
      )}

      {mode && (
        <div className="border rounded-xl p-3 space-y-4 bg-slate-50">
          <div className="flex rounded-lg border bg-white p-0.5 text-sm">
            {(['dates', 'weekly'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} className={`flex-1 min-h-9 py-1 rounded-md text-xs sm:text-sm ${mode === m ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-600'}`}>
                {m === 'dates' ? 'Chọn ngày / 指定日期' : 'Hằng tuần / 每週固定'}
              </button>
            ))}
          </div>
          {mode === 'dates' ? (
            <>
              <MultiDateCalendar value={dates} onChange={setDates} />
              <p className="text-xs text-slate-500">Đã chọn / 已選 {dates.size} ngày／天{dates.size ? `：${[...dates].sort().map(d => d.slice(5)).join('、')}` : ''}</p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-500 space-y-1">Từ ngày / 開始日<input type="date" className={input} value={wk.start_date} min={t0} onChange={e => setWk({ ...wk, start_date: e.target.value, end_date: wk.end_date < e.target.value ? e.target.value : wk.end_date })} /></label>
                <label className="text-xs text-slate-500 space-y-1">Đến ngày / 結束日<input type="date" className={input} value={wk.end_date} min={wk.start_date} max={addDay(wk.start_date, 91)} onChange={e => setWk({ ...wk, end_date: e.target.value })} /></label>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500">Thứ (bỏ trống = mỗi ngày) / 星期（不選＝每天）</div>
                <div className="grid grid-cols-7 gap-1">
                  {WD_ORDER.map(n => (
                    <button key={n} type="button" onClick={() => toggleWd(n)}
                      className={`h-10 rounded-lg border text-xs ${wk.weekdays.includes(n) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white'}`}>
                      {WD[n]}<br />{WD_ZH[n]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <SlotPicker value={slots} onChange={setSlots} />
          {mode === 'dates' && <p className="text-[11px] text-slate-500">Lưu sẽ thay thế giờ đã điền cho các ngày này; không chọn giờ = xóa. 儲存會取代這些日期原本填的時段；不選時段＝清除這些日期。</p>}
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy || !canSave} className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu / 儲存'}</Button>
            <Button variant="outline" onClick={() => setMode(null)} className="h-11 rounded-xl">Hủy / 取消</Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Các ngày tới (bấm để sửa) / 未來每天（點一下可修改）</span>
          <span className="flex gap-3 font-mono"><span>06</span><span>12</span><span>18</span><span>24</span></span>
        </div>
        {upcoming.map(d => {
          const rs = merge(rules.filter(r => ruleOn(r, d)).map(r => ({ start: r.start_min, end: r.end_min })))
          return (
            <button key={d} onClick={() => open('dates', d)} className="w-full grid grid-cols-[84px_1fr] md:grid-cols-[84px_1fr_150px] items-center gap-2 text-left text-sm py-0.5 hover:bg-slate-50 rounded">
              <span className={wdNum(d) === 0 || wdNum(d) === 6 ? 'text-rose-600' : ''}>{d.slice(5)} {wd(d)}</span>
              <DayBar ranges={rs} />
              <span className="hidden md:block text-xs text-slate-500 truncate">{rs.length ? rangesText(rs) : '—'}</span>
            </button>
          )
        })}
        {span < 56 && <button onClick={() => setSpan(s => s + 14)} className="w-full text-xs text-indigo-700 py-1">Xem thêm / 顯示更多日期</button>}
      </div>

      {weekly.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-600">Hằng tuần / 每週固定時段</div>
          {weekly.map(r => (
            <div key={r.id} className="border rounded-xl p-3 text-sm flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{r.start_date.slice(5)} ~ {r.end_date.slice(5)} · {hhmm(r.start_min)}–{hhmm(r.end_min)}</div>
                <div className="text-xs text-slate-500">{wdText(r.weekdays)}{r.note ? ` · ${r.note}` : ''}</div>
              </div>
              <button onClick={() => remove(r.id)} className="text-xs text-red-500 px-2 py-1">Xóa / 刪除</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

type Profile = Record<string, string | null>
const PROFILE_FIELDS: { key: string; label: string; type?: string; free?: boolean; area?: boolean; options?: [string, string][] }[] = [
  { key: 'phone', label: 'Điện thoại / 電話', free: true },
  { key: 'address', label: 'Địa chỉ / 地址', free: true },
  { key: 'notify_channel', label: 'Nhận thông báo qua / 通知方式', free: true, options: [['email', 'Email'], ['zalo', 'Zalo']] },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'birthday', label: 'Ngày sinh / 生日', type: 'date' },
  { key: 'gender', label: 'Giới tính / 性別', options: [['', '—'], ['Nam', 'Nam / 男'], ['Nữ', 'Nữ / 女']] },
  { key: 'native_place', label: 'Quê quán / 籍貫' },
  { key: 'id_number', label: 'Số CCCD / 身分證號' },
  { key: 'id_issue_date', label: 'Ngày cấp / 發證日期', type: 'date' },
  { key: 'id_issue_place', label: 'Nơi cấp / 發證地點' },
  { key: 'education', label: 'Trình độ học vấn / 學歷' },
  { key: 'bank_name', label: 'Ngân hàng / 銀行' },
  { key: 'bank_account', label: 'Số tài khoản / 銀行帳號' },
  { key: 'tax_code', label: 'Mã số thuế / 稅號' },
  { key: 'resume_text', label: 'Kinh nghiệm làm việc, giới thiệu / 工作經歷、自我介紹', area: true },
]
const normGender = (g: string | null | undefined) => { const v = (g ?? '').trim().toLowerCase(); return v === 'nam' || v === '男' ? 'Nam' : v === 'nữ' || v === '女' ? 'Nữ' : '' }

// 我的履歷：員工自行補充／修改（人事可關閉；聯絡方式隨時可改）
function ProfileCard({ api }: { api: string }) {
  const [data, setData] = useState<{ profile: Profile; open: boolean; until: string | null } | null>(null)
  const [form, setForm] = useState<Profile>({})
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const load = useCallback(async () => {
    const r = await fetch(`${api}/profile`)
    if (!r.ok) return
    const d = await r.json()
    setData(d)
    setForm({ ...d.profile, gender: normGender(d.profile.gender) || d.profile.gender || '' })
  }, [api])
  useEffect(() => { load() }, [load])
  if (!data) return null
  const p = data.profile
  const filled = PROFILE_FIELDS.filter(f => !f.options || f.key === 'gender').filter(f => String(p[f.key] ?? '').trim()).length
  const total = PROFILE_FIELDS.filter(f => !f.options || f.key === 'gender').length

  async function save() {
    setBusy(true); setMsg('')
    const body = Object.fromEntries(PROFILE_FIELDS.filter(f => f.free || data!.open).map(f => [f.key, form[f.key] ?? '']))
    if (body.gender === normGender(p.gender)) body.gender = p.gender ?? ''
    const r = await fetch(`${api}/profile`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(j.error ?? 'Lưu thất bại / 儲存失敗'); return }
    setEditing(false); load()
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold flex items-center gap-2"><UserRound className="h-4 w-4" /> Hồ sơ của tôi / 我的履歷</h2>
        <span className={`text-xs px-2 py-1 rounded-full ${filled >= total ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{filled}/{total}</span>
      </div>
      {!data.open
        ? <p className="text-xs text-amber-700 flex items-start gap-1"><Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />Đã khóa chỉnh sửa; vẫn sửa được điện thoại, địa chỉ. 履歷修改已關閉，仍可改電話、地址與通知方式；需修改請聯絡人事。</p>
        : data.until ? <p className="text-xs text-slate-500">Có thể sửa đến / 可修改至 {data.until.slice(0, 10)}</p> : null}
      {!editing ? (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            {PROFILE_FIELDS.filter(f => f.key !== 'resume_text' && f.key !== 'notify_channel').map(f => (
              <div key={f.key} className="contents">
                <dt className="text-slate-500 text-xs pt-0.5">{f.label}</dt>
                <dd className={`break-all ${String(p[f.key] ?? '').trim() ? '' : 'text-rose-400'}`}>{String(p[f.key] ?? '').trim() || 'Chưa điền / 未填'}</dd>
              </div>
            ))}
          </dl>
          <div className="text-xs text-slate-500">{PROFILE_FIELDS[PROFILE_FIELDS.length - 1].label}</div>
          <p className="text-sm whitespace-pre-wrap">{p.resume_text || <span className="text-rose-400">Chưa điền / 未填</span>}</p>
          <Button variant="outline" onClick={() => { setEditing(true); setMsg('') }} className="w-full h-10 rounded-xl">Chỉnh sửa / 編輯</Button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {PROFILE_FIELDS.map(f => {
              const dis = !f.free && !data.open
              const val = String(form[f.key] ?? '')
              const set = (v: string) => setForm(s => ({ ...s, [f.key]: v }))
              return (
                <label key={f.key} className={`text-xs text-slate-500 space-y-1 ${f.area ? 'sm:col-span-2' : ''}`}>
                  <span>{f.label}</span>
                  {f.options ? (
                    <select disabled={dis} className={`${input} disabled:bg-slate-100`} value={val} onChange={e => set(e.target.value)}>
                      {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  ) : f.area ? (
                    <textarea disabled={dis} rows={5} className="w-full px-3 py-2 rounded-xl border text-base outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-100" value={val} onChange={e => set(e.target.value)} />
                  ) : (
                    <input disabled={dis} type={f.type ?? 'text'} className={`${input} disabled:bg-slate-100`} value={val} onChange={e => set(e.target.value)} />
                  )}
                </label>
              )
            })}
          </div>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy} className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu / 儲存'}</Button>
            <Button variant="outline" onClick={() => { setEditing(false); load() }} className="h-11 rounded-xl">Hủy / 取消</Button>
          </div>
        </div>
      )}
    </Card>
  )
}

interface DocItem { type: string; label: string; required: boolean; either: boolean; paper: boolean; files: { id: string; file_name: string; uploaded_at: string; can_delete: boolean }[] }

// 人事文件：查看需繳文件、上傳照片或 PDF
function DocsCard({ api }: { api: string }) {
  const [items, setItems] = useState<DocItem[] | null>(null)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [showAll, setShowAll] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pending = useRef('')
  const load = useCallback(async () => {
    const r = await fetch(`${api}/docs`)
    if (r.ok) setItems((await r.json()).items)
  }, [api])
  useEffect(() => { load() }, [load])
  if (!items) return null

  const done = (d: DocItem) => d.files.length > 0 || d.paper
  const eduDone = items.filter(d => d.either).some(done)
  const isMissing = (d: DocItem) => d.required && !done(d) && !(d.either && eduDone)
  const required = items.filter(d => d.required && !d.either)
  const total = required.length + 1
  const okCount = required.filter(done).length + (eduDone ? 1 : 0)
  const list = [...items].sort((a, b) => Number(isMissing(b)) - Number(isMissing(a)) || Number(b.required) - Number(a.required))
  const visible = showAll ? list : list.filter(d => d.required || d.files.length > 0)

  function pick(type: string) { pending.current = type; setErr(''); fileRef.current?.click() }
  async function upload(files: FileList | null) {
    const type = pending.current
    if (!files?.length || !type) return
    setBusy(type)
    for (const f of Array.from(files)) {
      const fd = new FormData(); fd.append('file', f); fd.append('doc_type', type)
      const r = await fetch(`${api}/docs`, { method: 'POST', body: fd })
      if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? 'Tải lên thất bại / 上傳失敗'); break }
    }
    setBusy(''); if (fileRef.current) fileRef.current.value = ''
    load()
  }
  async function remove(id: string) {
    if (!confirm('Xóa tệp này? / 刪除這個檔案？')) return
    const r = await fetch(`${api}/docs`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? 'Lỗi / 錯誤')
    load()
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold flex items-center gap-2"><Paperclip className="h-4 w-4" /> Hồ sơ nhân sự / 人事文件</h2>
        <span className={`text-xs px-2 py-1 rounded-full ${okCount >= total ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{okCount}/{total}</span>
      </div>
      <p className="text-xs text-slate-500">Chụp ảnh hoặc chọn PDF (tối đa 10MB). Bản gốc giấy vẫn nộp cho nhân sự. 可拍照或選 PDF 上傳（每檔 10MB 內）；正本紙本仍需交給人事。</p>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={e => upload(e.target.files)} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="divide-y">
        {visible.map(d => (
          <div key={d.type} className="py-2.5 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm">
                <div className="font-medium">{d.label}</div>
                <div className="flex flex-wrap gap-1 mt-0.5 text-[11px]">
                  {isMissing(d) && <span className="px-1.5 rounded bg-rose-100 text-rose-700">Còn thiếu / 缺件</span>}
                  {d.either && <span className="px-1.5 rounded bg-slate-100 text-slate-600">1 trong 2 / 擇一</span>}
                  {d.paper && <span className="px-1.5 rounded bg-emerald-100 text-emerald-700">NS đã nhận giấy / 人事已收紙本</span>}
                </div>
              </div>
              <button onClick={() => pick(d.type)} disabled={!!busy} className="shrink-0 flex items-center gap-1 text-xs px-3 py-2 rounded-lg border text-indigo-700 disabled:opacity-50">
                {busy === d.type ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Tải lên / 上傳
              </button>
            </div>
            {d.files.map(f => (
              <div key={f.id} className="flex items-center justify-between gap-2 text-xs bg-slate-50 rounded-lg px-2 py-1.5">
                <a href={`${api}/docs?file=${f.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-700 truncate">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" /><span className="truncate">{f.file_name}</span>
                </a>
                {f.can_delete && <button onClick={() => remove(f.id)} className="text-red-500 p-1" title="Xóa / 刪除"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <button onClick={() => setShowAll(v => !v)} className="w-full text-xs text-indigo-700 py-1">{showAll ? 'Thu gọn / 收合' : 'Tài liệu khác / 其他文件'}</button>
    </Card>
  )
}

// 正職：點日期選擇期待休假日（今天起約 3 個月），再點一次取消
function DayOffCard({ api, dayoffs, onChanged }: { api: string; dayoffs: { id: string; off_date: string }[]; onChanged: () => void }) {
  const [offset, setOffset] = useState(0)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const picked = new Set(dayoffs.map(d => d.off_date))
  const t0 = today()
  const base = new Date(t0 + 'T00:00:00Z')
  const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1))
  const y = first.getUTCFullYear(), m = first.getUTCMonth()
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const lead = (first.getUTCDay() + 6) % 7
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(Date.UTC(y, m, i + 1)).toISOString().slice(0, 10))]
  const limit = new Date(Date.parse(t0 + 'T00:00:00Z') + 92 * 86400000).toISOString().slice(0, 10)
  async function toggle(d: string) {
    setBusy(d); setErr('')
    const r = await fetch(`${api}/dayoff`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: d }) })
    const j = await r.json().catch(() => ({}))
    setBusy('')
    if (!r.ok) { setErr(j.error ?? 'Lỗi / 錯誤'); return }
    onChanged()
  }
  return (
    <Card className="p-5 space-y-3">
      <h2 className="font-bold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Ngày muốn nghỉ / 期待休假日</h2>
      <p className="text-xs text-slate-500">Bấm vào ngày bạn muốn nghỉ, bấm lại để bỏ. Cửa hàng trưởng sẽ tham khảo khi xếp ca. 點選希望休假的日期，再點一次取消；店長排班時會參考。</p>
      <div className="flex items-center justify-between">
        <button onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0} className="px-3 py-1 rounded-lg border disabled:opacity-30">‹</button>
        <b className="text-sm">{m + 1}/{y}</b>
        <button onClick={() => setOffset(o => Math.min(3, o + 1))} disabled={offset === 3} className="px-3 py-1 rounded-lg border disabled:opacity-30">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WD_ORDER.map(n => <div key={n} className="text-[11px] text-slate-400">{WD[n]}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const off = picked.has(d), disabled = d < t0 || d > limit
          return (
            <button key={d} disabled={disabled || busy === d} onClick={() => toggle(d)}
              className={`h-10 rounded-lg text-sm ${off ? 'bg-rose-500 text-white font-bold' : disabled ? 'text-slate-300' : 'bg-white border'}`}>
              {busy === d ? '…' : Number(d.slice(8))}
            </button>
          )
        })}
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <p className="text-xs text-slate-500">Đã chọn / 已選：{dayoffs.length ? dayoffs.map(d => `${d.off_date.slice(5)} (${wd(d.off_date)})`).join('、') : '—'}</p>
    </Card>
  )
}
