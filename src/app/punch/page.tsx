'use client'

// 打卡入口 /punch：
// 1. 公司子網域上已登入員工專區 → 直接進員工專區打卡
// 2. 已登入 ERP 帳號（任何網域，例如 office.im-tourist.com/punch）→ 依帳號綁定的員工與公司直接打卡
// 3. 公司子網域、未登入 → 記得上次打卡編號就直接前往，否則輸入打卡編號
// 4. 其他 → 請先登入
// 員工可把這個網址加到手機主畫面，一鍵打卡。
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, Loader2 } from 'lucide-react'
import { PunchCard } from '@/components/hr/PunchCard'

const PUNCH_NO_KEY = 'punch_no'
type Mode = 'loading' | 'me' | 'enter-no' | 'login' | 'no-employee'

export default function PunchEntryPage() {
  const [mode, setMode] = useState<Mode>('loading')
  const [who, setWho] = useState<{ employee: string; company: string } | null>(null)
  const [no, setNo] = useState('')

  useEffect(() => {
    const go = (n: string) => window.location.replace(`/e/${encodeURIComponent(n)}#shift`)
    ;(async () => {
      const cur = await fetch('/api/e/current').catch(() => null)
      const d = cur?.ok ? await cur.json().catch(() => null) : null
      if (d?.no) return go(d.no)
      const onCompanyHost = cur?.status === 401 // 404＝不是公司子網域
      const me = await fetch('/api/me/punch').catch(() => null)
      if (me?.ok) {
        const j = await me.json().catch(() => ({}))
        setWho({ employee: j.employee ?? '', company: j.company ?? '' }); setMode('me'); return
      }
      if (me?.status === 404 && !onCompanyHost) { setMode('no-employee'); return }
      if (onCompanyHost) {
        let saved = ''
        try { saved = localStorage.getItem(PUNCH_NO_KEY) ?? '' } catch { /* ignore */ }
        if (saved) return go(saved)
        setMode('enter-no'); return
      }
      setMode('login')
    })()
  }, [])

  const submit = () => {
    const n = no.replace(/\D/g, '')
    if (!n) return
    try { localStorage.setItem(PUNCH_NO_KEY, n) } catch { /* ignore */ }
    window.location.href = `/e/${encodeURIComponent(n)}#shift`
  }

  if (mode === 'me') return (
    <div className="min-h-dvh bg-slate-50 p-4">
      <div className="max-w-md mx-auto space-y-3">
        <div className="text-center pt-2">
          <p className="text-sm text-slate-500">{who?.company}</p>
          <p className="text-lg font-bold">{who?.employee}</p>
        </div>
        <PunchCard api="/api/me" />
        <p className="text-xs text-slate-500 text-center">Thêm trang này vào màn hình chính để chấm công nhanh. / 把此頁加到手機主畫面，下次一鍵打卡。</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow p-6 space-y-4 text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-600 text-white grid place-items-center"><Clock className="h-7 w-7" /></div>
        <h1 className="text-xl font-bold">Chấm công / 打卡</h1>
        {mode === 'loading' && <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />}
        {mode === 'enter-no' && (
          <>
            <input inputMode="numeric" autoFocus value={no} onChange={e => setNo(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="Mã chấm công / 打卡編號" className="w-full h-12 px-3 rounded-xl border text-lg text-center outline-none focus:ring-2 focus:ring-emerald-500" />
            <button onClick={submit} disabled={!no.trim()} className="w-full h-12 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50">Tiếp tục / 繼續</button>
            <p className="text-xs text-slate-500">Thêm trang này vào màn hình chính để chấm công nhanh. / 把此頁加到手機主畫面，下次一鍵打卡。</p>
          </>
        )}
        {mode === 'login' && (
          <>
            <p className="text-sm text-slate-600">Vui lòng đăng nhập tài khoản ERP trước / 請先登入 ERP 帳號，登入後再開此頁即可打卡</p>
            <Link href="/login" className="block w-full h-12 leading-[3rem] rounded-xl bg-emerald-600 text-white font-bold">Đăng nhập / 登入</Link>
          </>
        )}
        {mode === 'no-employee' && (
          <p className="text-sm text-amber-700">Tài khoản chưa liên kết hồ sơ nhân viên, vui lòng liên hệ nhân sự / 此帳號尚未綁定在職員工資料，請聯絡人事（人事系統 → 員工名冊 → 系統帳號）</p>
        )}
      </div>
    </div>
  )
}
