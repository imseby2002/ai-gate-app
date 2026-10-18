'use client'

// 員工專區：<公司子網域>/e/<打卡編號>。首次以生日（DDMMYYYY）登入並設定自己的密碼，之後用密碼登入。
import { useCallback, useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Loader2, LogOut, KeyRound, FileText, CheckCircle2, CalendarDays } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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

interface Period {
  id: string; title: string; start_date: string; end_date: string; status: string
  slots: { code: string; label: string }[]; dates: string[]; selected: string[]; assigned: string[]
}

// 預設時段代碼的越文名稱；自訂時段沿用店長設定的名稱
const SLOT_VI: Record<string, string> = { am: 'Sáng', pm: 'Chiều', night: 'Tối' }
const slotName = (s: { code: string; label: string }) => (SLOT_VI[s.code] ? `${SLOT_VI[s.code]} / ${s.label}` : s.label)
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const wd = (d: string) => WD[new Date(d + 'T00:00:00Z').getUTCDay()] ?? ''

// 工讀生：可上班時段與已確認班表
function ShiftCard({ api }: { api: string }) {
  const [periods, setPeriods] = useState<Period[] | null>(null)
  const [open, setOpen] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(true)

  const load = useCallback(async () => {
    const r = await fetch(`${api}/shifts`)
    const d = r.ok ? await r.json() : null
    setPeriods(d?.partTime ? d.periods : null)
  }, [api])

  useEffect(() => { load() }, [load])

  if (!periods) return null

  const edit = (p: Period) => { setOpen(open === p.id ? '' : p.id); setSel(new Set(p.selected)); setMsg('') }
  const toggle = (k: string) => setSel(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })

  async function submit(p: Period) {
    setBusy(true); setMsg('')
    const r = await fetch(`${api}/shifts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period_id: p.id, selected: [...sel] }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    setMsgOk(r.ok)
    if (!r.ok) { setMsg(d.error ?? 'Gửi thất bại / 送出失敗'); return }
    setMsg('Đã gửi / 已送出 ✓')
    await load()
  }

  return (
    <Card className="p-5 space-y-3">
      <h2 className="font-bold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Thời gian có thể làm / 可上班時段</h2>
      {periods.length === 0 && <p className="text-sm text-slate-500">Chưa có kỳ xếp ca / 目前沒有排班期</p>}
      {periods.map(p => {
        const confirmed = p.status === 'confirmed'
        return (
          <div key={p.id} className="border rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-medium text-sm">{p.title || `${p.start_date} ~ ${p.end_date}`}</div>
                <div className="text-xs text-slate-500">{p.start_date} ~ {p.end_date}</div>
              </div>
              {confirmed
                ? <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Đã chốt lịch / 已確認</span>
                : <button onClick={() => edit(p)} className="text-sm px-3 py-1.5 rounded-lg border text-indigo-700">
                  {p.selected.length ? `Sửa / 修改 (${p.selected.length})` : 'Điền / 填寫'}
                </button>}
            </div>
            {confirmed && (
              <div className="text-sm">
                <div className="text-xs text-slate-500 mb-1">Lịch làm của tôi / 我的班表</div>
                {p.assigned.length === 0 && <p className="text-slate-500">Không có ca / 未排班</p>}
                {[...p.assigned].sort().map(k => {
                  const [d, code] = k.split('|')
                  const slot = p.slots.find(s => s.code === code)
                  return <div key={k}>{d.slice(5)} ({wd(d)}) · {slot ? slotName(slot) : code}</div>
                })}
              </div>
            )}
            {!confirmed && open === p.id && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Chọn ngày và ca bạn có thể làm rồi bấm Gửi. 勾選可以上班的日期與時段後送出。</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left py-1 text-slate-500 font-normal">Ngày / 日期</th>
                        {p.slots.map(s => <th key={s.code} className="py-1 text-slate-500 font-normal">{slotName(s)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {p.dates.map(d => (
                        <tr key={d} className="border-t">
                          <td className="py-1 whitespace-nowrap">{d.slice(5)} <span className="text-slate-400">({wd(d)})</span></td>
                          {p.slots.map(s => {
                            const k = `${d}|${s.code}`
                            const on = sel.has(k)
                            return (
                              <td key={s.code} className="text-center py-1">
                                <button onClick={() => toggle(k)} className={`w-9 h-9 rounded-lg border ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white text-slate-300'}`}>{on ? '✓' : ''}</button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Đã chọn / 已選 <b>{sel.size}</b></span>
                  <Button onClick={() => submit(p)} disabled={busy} className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gửi / 送出'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      {msg && <p className={`text-sm ${msgOk ? 'text-emerald-700' : 'text-red-600'}`}>{msg}</p>}
    </Card>
  )
}
