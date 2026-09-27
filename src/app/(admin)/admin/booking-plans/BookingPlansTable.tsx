'use client'

import { useState, useCallback, useEffect } from 'react'
import { Search, Loader2, Save } from 'lucide-react'

type BookingPlan = 'free' | 'core' | 'pro' | 'enterprise'
const PLAN_LABEL: Record<BookingPlan, string> = { free: 'FREE', core: 'CORE', pro: 'PRO', enterprise: 'MAX' }
const PLANS: BookingPlan[] = ['free', 'core', 'pro', 'enterprise']
// 與 lib/booking/entitlements.ts 的 csIntegration 一致：客服 AI 查訂單／給入住密碼
const CS_LOOKUP: Record<BookingPlan, boolean> = { free: false, core: false, pro: true, enterprise: true }

interface Row {
  id: string
  email: string | null
  full_name: string | null
  booking_subscriptions: { plan: BookingPlan; billing_cycle: string; status: string; current_period_end: string | null }[] | null
  company_grant?: { source: 'company' | 'enterprise'; companyName: string } | null
}

export function BookingPlansTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, BookingPlan>>({})

  const load = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/booking-plans?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setRows(data.users ?? [])
    } catch { setRows([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load('') }, [load])

  // booking_subscriptions 以 user_id 為主鍵（一對一），PostgREST 內嵌時回傳單一物件而不是陣列；
  // 之前一律用 [0] 取值，所有帳號都被顯示成 FREE。兩種形狀都相容。
  const subOf = (r: Row) => {
    const v = r.booking_subscriptions as unknown
    return (Array.isArray(v) ? v[0] : v) as NonNullable<Row['booking_subscriptions']>[number] | undefined
  }
  // 實際生效方案：所屬公司開通此模組（公司版／專屬客製-企業版）→ MAX；否則為帳號自訂方案（到期或非 active 視為 FREE）
  const effectiveOf = (r: Row): { plan: BookingPlan; via: string | null } => {
    if (r.company_grant) {
      return { plan: 'enterprise', via: `${r.company_grant.source === 'enterprise' ? '專屬客製-企業版' : '公司版'}・${r.company_grant.companyName}` }
    }
    const sub = subOf(r)
    const active = sub?.status === 'active' && (!sub.current_period_end || new Date(sub.current_period_end).getTime() > Date.now())
    return { plan: active ? sub!.plan : 'free', via: null }
  }
  const currentPlan = (r: Row): BookingPlan => pending[r.id] ?? subOf(r)?.plan ?? 'free'

  const save = async (r: Row) => {
    setSaving(r.id)
    try {
      await fetch('/api/admin/booking-plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: r.id, plan: currentPlan(r) }),
      })
      await load(q)
    } finally { setSaving(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(q)}
            placeholder="搜尋 email"
            className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <button onClick={() => load(q)} className="text-sm px-3 py-2 rounded-lg border hover:bg-gray-50">搜尋</button>
      </div>

      <div className="border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">姓名</th>
                <th className="px-4 py-2.5 font-medium">帳號自訂方案</th>
                <th className="px-4 py-2.5 font-medium">實際生效</th>
                <th className="px-4 py-2.5 font-medium">客服查訂單</th>
                <th className="px-4 py-2.5 font-medium">到期日</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const plan = currentPlan(r)
                const sub = subOf(r)
                const eff = effectiveOf(r)
                const dirty = pending[r.id] && pending[r.id] !== (sub?.plan ?? 'free')
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5">{r.email}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.full_name ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={plan}
                        onChange={e => setPending(p => ({ ...p, [r.id]: e.target.value as BookingPlan }))}
                        className="text-xs border rounded-lg px-2 py-1 bg-white"
                      >
                        {PLANS.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="font-semibold">{PLAN_LABEL[eff.plan]}</span>
                      {eff.via && <span className="block text-[11px] text-indigo-600">來自 {eff.via}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {CS_LOOKUP[eff.plan] ? <span className="text-green-600">✓ 可查</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('zh-TW') : '—（不到期）'}
                    </td>
                    <td className="px-4 py-2.5">
                      {dirty && (
                        <button onClick={() => save(r)} disabled={saving === r.id}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                          {saving === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          儲存
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
