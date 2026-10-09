'use client'

// 廠商填表好記網址：<公司子網域>/v/<代號>。輸入公司提供的密碼後進入填表，可自行變更密碼。
import { useEffect, useState, use } from 'react'
import { Loader2, KeyRound, LogOut } from 'lucide-react'
import VendorFill from '../../vendor/VendorFill'

const input = 'w-full h-11 px-3 rounded-xl border text-base outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

export default function VendorLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const api = `/api/v/${encodeURIComponent(slug)}`
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [changing, setChanging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch(`${api}/login`).then(async r => {
      if (r.ok) setToken((await r.json()).token)
      setLoading(false)
    })
  }, [api])

  async function login() {
    setBusy(true); setMsg('')
    const r = await fetch(`${api}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (r.ok) { setToken(d.token); setPin('') } else setMsg(d.error ?? '登入失敗')
  }

  async function savePin() {
    setBusy(true); setMsg('')
    const r = await fetch(`${api}/pin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: newPin }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (r.ok) { setNewPin(''); setChanging(false); setMsg('✅ 密碼已變更') } else setMsg(d.error ?? '變更失敗')
  }

  async function logout() {
    await fetch(`${api}/login`, { method: 'DELETE' })
    setToken(null)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border p-6 space-y-4 shadow-sm">
          <h1 className="text-xl font-bold">廠商填報登入</h1>
          <input type="password" autoComplete="current-password" className={input} value={pin}
            onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="請輸入公司提供的密碼" />
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          <button onClick={login} disabled={busy || !pin} className="w-full h-11 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-60">
            {busy ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : '登入'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-50/80">
      <div className="max-w-3xl mx-auto px-4 pt-4 flex flex-wrap items-center justify-end gap-2 text-sm">
        {changing ? (
          <>
            <input type="password" autoComplete="new-password" className="h-9 px-3 rounded-lg border bg-white" value={newPin}
              onChange={e => setNewPin(e.target.value)} placeholder="新密碼（至少 6 碼）" />
            <button onClick={savePin} disabled={busy || newPin.length < 6} className="h-9 px-3 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-60">儲存</button>
            <button onClick={() => setChanging(false)} className="h-9 px-3 rounded-lg border">取消</button>
          </>
        ) : (
          <button onClick={() => setChanging(true)} className="h-9 px-3 rounded-lg border bg-white inline-flex items-center gap-1"><KeyRound className="h-4 w-4" />變更密碼</button>
        )}
        <button onClick={logout} className="h-9 px-3 rounded-lg border bg-white inline-flex items-center gap-1"><LogOut className="h-4 w-4" />登出</button>
        {msg && <span className="w-full text-right">{msg}</span>}
      </div>
      <VendorFill token={token} />
    </div>
  )
}
