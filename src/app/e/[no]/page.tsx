'use client'

// 員工專區：<公司子網域>/e/<打卡編號>。首次以生日（DDMMYYYY）登入並設定自己的密碼，之後用密碼登入。
import { useCallback, useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Loader2, LogOut, KeyRound, FileText, CheckCircle2, CalendarDays } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SLOT_MIN } from '@/lib/shift/time'

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
    <div className="min-h-screen bg-slate-100 py-8 px-4 flex justify-center">
      <div className="max-w-md w-full space-y-4">
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
            <ShiftCard api={api} />
          </>
        )}
      </div>
    </div>
  )
}

interface AvailRuleRow { id: string; start_date: string; end_date: string; weekdays: number[]; start_min: number; end_min: number; note: string }
interface MyPlan { id: string; store: string; work_date: string; start_min: number; end_min: number }

const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const WD_ZH = ['日', '一', '二', '三', '四', '五', '六']
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0]
const wd = (d: string) => WD[new Date(d + 'T00:00:00Z').getUTCDay()] ?? ''
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const TIME_OPTS = Array.from({ length: 1440 / SLOT_MIN }, (_, i) => hhmm(i * SLOT_MIN))
const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)

// 員工：填可上班時段（日期區間＋星期＋時間）與查看已發布班表
function ShiftCard({ api }: { api: string }) {
  const [data, setData] = useState<{ store: string | null; rules: AvailRuleRow[]; plans: MyPlan[] } | null>(null)
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ start_date: today(), end_date: today(), weekdays: [] as number[], start: '08:00', end: '12:00', note: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const r = await fetch(`${api}/shifts`)
    setData(r.ok ? await r.json() : null)
  }, [api])
  useEffect(() => { load() }, [load])

  if (!data?.store) return null

  const toggleWd = (n: number) => setF(p => ({ ...p, weekdays: p.weekdays.includes(n) ? p.weekdays.filter(x => x !== n) : [...p.weekdays, n] }))

  async function add() {
    setBusy(true); setMsg('')
    const r = await fetch(`${api}/shifts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(d.error ?? 'Lưu thất bại / 儲存失敗'); return }
    setAdding(false)
    await load()
  }
  async function remove(id: string) {
    if (!confirm('Xóa? / 刪除這筆？')) return
    await fetch(`${api}/shifts`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }
  const wdText = (w: number[]) => w.length === 0 || w.length === 7 ? 'Mỗi ngày / 每天' : WD_ORDER.filter(n => w.includes(n)).map(n => `${WD[n]}/${WD_ZH[n]}`).join(' ')

  return (
    <>
      <Card className="p-5 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Lịch làm của tôi / 我的班表</h2>
        {data.plans.length === 0 && <p className="text-sm text-slate-500">Chưa có lịch / 尚無已發布的班表</p>}
        <div className="divide-y text-sm">
          {data.plans.map(p => (
            <div key={p.id} className="flex justify-between py-2">
              <span>{p.work_date.slice(5)} ({wd(p.work_date)})</span>
              <b>{hhmm(p.start_min)} – {hhmm(p.end_min)}</b>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Thời gian có thể làm / 可上班時段</h2>
          {!adding && <button onClick={() => { setAdding(true); setMsg('') }} className="text-sm px-3 py-1.5 rounded-lg border text-indigo-700">+ Thêm / 新增</button>}
        </div>
        <p className="text-xs text-slate-500">Ví dụ: 01/11–30/11, T4 + T5, 15:30–19:30. 例：11/1–11/30 每週三、四 15:30–19:30。</p>
        {data.rules.length === 0 && !adding && <p className="text-sm text-slate-500">Chưa điền / 尚未填寫</p>}
        <div className="space-y-2">
          {data.rules.map(r => (
            <div key={r.id} className="border rounded-xl p-3 text-sm flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{r.start_date.slice(5)} ~ {r.end_date.slice(5)} · {hhmm(r.start_min)}–{hhmm(r.end_min)}</div>
                <div className="text-xs text-slate-500">{wdText(r.weekdays)}{r.note ? ` · ${r.note}` : ''}</div>
              </div>
              <button onClick={() => remove(r.id)} className="text-xs text-red-500 px-2 py-1">Xóa / 刪除</button>
            </div>
          ))}
        </div>
        {adding && (
          <div className="border rounded-xl p-3 space-y-3 bg-slate-50">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500 space-y-1">Từ ngày / 開始日<input type="date" className={input} value={f.start_date} min={today()} onChange={e => setF({ ...f, start_date: e.target.value, end_date: f.end_date < e.target.value ? e.target.value : f.end_date })} /></label>
              <label className="text-xs text-slate-500 space-y-1">Đến ngày / 結束日<input type="date" className={input} value={f.end_date} min={f.start_date} onChange={e => setF({ ...f, end_date: e.target.value })} /></label>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Thứ (bỏ trống = mỗi ngày) / 星期（不選＝每天）</div>
              <div className="flex flex-wrap gap-1.5">
                {WD_ORDER.map(n => (
                  <button key={n} type="button" onClick={() => toggleWd(n)}
                    className={`w-11 h-10 rounded-lg border text-xs ${f.weekdays.includes(n) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white'}`}>
                    {WD[n]}<br />{WD_ZH[n]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500 space-y-1">Từ / 從
                <select className={input} value={f.start} onChange={e => setF({ ...f, start: e.target.value })}>{TIME_OPTS.map(t => <option key={t}>{t}</option>)}</select>
              </label>
              <label className="text-xs text-slate-500 space-y-1">Đến / 到
                <select className={input} value={f.end} onChange={e => setF({ ...f, end: e.target.value })}>{[...TIME_OPTS.slice(1), '24:00'].map(t => <option key={t}>{t}</option>)}</select>
              </label>
            </div>
            <input className={input} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="Ghi chú (không bắt buộc) / 備註（可空）" />
            {msg && <p className="text-sm text-red-600">{msg}</p>}
            <div className="flex gap-2">
              <Button onClick={add} disabled={busy} className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu / 儲存'}</Button>
              <Button variant="outline" onClick={() => setAdding(false)} className="h-10 rounded-xl">Hủy / 取消</Button>
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
