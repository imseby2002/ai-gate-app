'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'

export default function JoinForm({ joinKey, name, source }: { joinKey: string; name: string; source: string }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', line_id: '', website: '' })
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true); setError(null)
    try {
      const res = await fetch(`/api/join/${encodeURIComponent(joinKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, consent, source }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? '送出失敗')
      else setDone(true)
    } catch { setError('網路錯誤，請稍後再試') }
    finally { setSending(false) }
  }

  const input = 'mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40'

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-white flex items-start sm:items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl border shadow-sm p-6">
        <h1 className="text-xl font-bold text-gray-900">加入{name ? `「${name}」` : ''}會員</h1>
        <p className="mt-1 text-sm text-gray-500">搶先收到專屬優惠與最新消息。</p>

        {done ? (
          <div className="mt-6 flex flex-col items-center text-center gap-2 py-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="font-semibold text-gray-900">已加入會員，謝謝你！</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">姓名 *</label>
              <input required maxLength={80} value={form.name} onChange={set('name')} className={input} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Email</label>
              <input type="email" maxLength={200} value={form.email} onChange={set('email')} className={input} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">手機</label>
              <input type="tel" maxLength={30} value={form.phone} onChange={set('phone')} className={input} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">LINE ID（選填）</label>
              <input maxLength={80} value={form.line_id} onChange={set('line_id')} className={input} />
            </div>
            {/* honeypot：真人看不到 */}
            <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')}
              className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden="true" />
            <p className="text-[11px] text-gray-400">Email 或手機至少填一項。</p>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
              <span>我同意接收優惠與活動通知，可隨時取消。</span>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={sending || !consent}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-blue-700">
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              加入會員
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
