'use client'

// 員工專區：<公司子網域>/e/<打卡編號>。首次以生日（DDMMYYYY）登入並設定自己的密碼，之後用密碼登入。
import { useCallback, useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Loader2, LogOut, KeyRound, FileText, CheckCircle2 } from 'lucide-react'
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
              <p className="text-xs text-slate-500">Lần đầu dùng ngày sinh, ví dụ 15/08/1995 → 15081995. 第一次請用生日登入。</p>
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
          </>
        )}
      </div>
    </div>
  )
}
