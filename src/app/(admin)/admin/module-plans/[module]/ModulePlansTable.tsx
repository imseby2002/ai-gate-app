'use client'

import { useState, useCallback, useEffect } from 'react'
import { Search, Loader2, Save } from 'lucide-react'
import { MODULE_PLANS, MODULE_PLAN_LABEL, type ModulePlan, type PlanModuleId } from '@/lib/module-plans/definitions'

interface Row {
  id: string
  email: string | null
  full_name: string | null
  user_type: 'admin' | 'employee' | 'external' | null
  subscription: { plan: ModulePlan; billing_cycle: string; status: string; current_period_end: string | null } | null
  company_grant: { source: 'company' | 'enterprise'; companyName: string } | null
  /** 公司成員：方案隨公司，不可個別設定 */
  company_name: string | null
}

export function ModulePlansTable({ moduleId }: { moduleId: PlanModuleId }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, ModulePlan>>({})

  const load = useCallback(async (query: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/module-plans?module=${moduleId}&q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '載入失敗')
      setRows(data.users ?? [])
      setPending({})
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : '載入失敗')
    } finally { setLoading(false) }
  }, [moduleId])

  useEffect(() => { load('') }, [load])

  // 實際生效方案：內部帳號／公司開通 → MAX；否則為帳號自訂方案（到期或非 active 視為 FREE）
  const effectiveOf = (r: Row): { plan: ModulePlan; via: string | null } => {
    if (r.user_type === 'admin' || r.user_type === 'employee') {
      return { plan: 'max', via: r.user_type === 'admin' ? '內部帳號（管理者）' : '內部帳號（員工）' }
    }
    if (r.company_grant) {
      return { plan: 'max', via: `${r.company_grant.source === 'enterprise' ? '專屬客製-企業版' : '公司版'}・${r.company_grant.companyName}` }
    }
    // 公司成員隨公司：公司未開通此模組即為 FREE
    if (r.company_name !== null) return { plan: 'free', via: `隨公司・${r.company_name}` }
    const sub = r.subscription
    const active = sub?.status === 'active' && (!sub.current_period_end || new Date(sub.current_period_end).getTime() > Date.now())
    return { plan: active ? sub!.plan : 'free', via: null }
  }
  const currentPlan = (r: Row): ModulePlan => pending[r.id] ?? r.subscription?.plan ?? 'free'

  const save = async (r: Row) => {
    setSaving(r.id)
    try {
      const res = await fetch('/api/admin/module-plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: r.id, module: moduleId, plan: currentPlan(r) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? '儲存失敗')
        return
      }
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

      {error && <div className="text-sm text-red-600">{error}</div>}

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
                <th className="px-4 py-2.5 font-medium">到期日</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const plan = currentPlan(r)
                const sub = r.subscription
                const eff = effectiveOf(r)
                const dirty = pending[r.id] && pending[r.id] !== (sub?.plan ?? 'free')
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5">{r.email}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.full_name ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {r.company_name !== null ? (
                        <span className="text-xs text-gray-400">隨公司</span>
                      ) : (
                      <select
                        value={plan}
                        onChange={e => setPending(p => ({ ...p, [r.id]: e.target.value as ModulePlan }))}
                        className="text-xs border rounded-lg px-2 py-1 bg-white"
                      >
                        {MODULE_PLANS.map(p => <option key={p} value={p}>{MODULE_PLAN_LABEL[p]}</option>)}
                      </select>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="font-semibold">{MODULE_PLAN_LABEL[eff.plan]}</span>
                      {eff.via && <span className="block text-[11px] text-indigo-600">來自 {eff.via}</span>}
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
