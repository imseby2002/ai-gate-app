'use client'

// 打卡快速入口：<公司子網域>/punch。已登入員工專區 → 直接進打卡；記得上次的打卡編號 → 直接前往；否則輸入打卡編號。
// 員工可把這個網址加到手機主畫面，一鍵打卡。
import { useEffect, useState } from 'react'
import { Clock, Loader2 } from 'lucide-react'

const PUNCH_NO_KEY = 'punch_no'

export default function PunchEntryPage() {
  const [ready, setReady] = useState(false)
  const [no, setNo] = useState('')

  useEffect(() => {
    const go = (n: string) => window.location.replace(`/e/${encodeURIComponent(n)}#shift`)
    fetch('/api/e/current').then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.no) return go(d.no)
      let saved = ''
      try { saved = localStorage.getItem(PUNCH_NO_KEY) ?? '' } catch { /* ignore */ }
      if (saved) return go(saved)
      setReady(true)
    }).catch(() => setReady(true))
  }, [])

  const submit = () => {
    const n = no.replace(/\D/g, '')
    if (!n) return
    try { localStorage.setItem(PUNCH_NO_KEY, n) } catch { /* ignore */ }
    window.location.href = `/e/${encodeURIComponent(n)}#shift`
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow p-6 space-y-4 text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-600 text-white grid place-items-center"><Clock className="h-7 w-7" /></div>
        <h1 className="text-xl font-bold">Chấm công / 打卡</h1>
        {!ready ? <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /> : (
          <>
            <input inputMode="numeric" autoFocus value={no} onChange={e => setNo(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="Mã chấm công / 打卡編號" className="w-full h-12 px-3 rounded-xl border text-lg text-center outline-none focus:ring-2 focus:ring-emerald-500" />
            <button onClick={submit} disabled={!no.trim()} className="w-full h-12 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50">Tiếp tục / 繼續</button>
            <p className="text-xs text-slate-500">Thêm trang này vào màn hình chính để chấm công nhanh. / 把此頁加到手機主畫面，下次一鍵打卡。</p>
          </>
        )}
      </div>
    </div>
  )
}
