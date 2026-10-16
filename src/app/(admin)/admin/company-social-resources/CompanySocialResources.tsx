'use client'

import { useState, useCallback, useEffect } from 'react'
import { Loader2, RefreshCw, Plus, Trash2 } from 'lucide-react'
import { companyPeriodPrice, companyMonthlyPrice, type BillingCycle } from '@/lib/connector/managed-pricing'

type Resources = {
  isp_gift: number
  residential_gift: number
  adspower_mode: 'own' | 'managed'
  env_quota: number
  member_seats: number
  group_name: string | null
  status: 'inactive' | 'active' | 'suspended'
  billing_cycle: BillingCycle
  price_credits: number | null
  paid_until: string | null
  auto_renew: boolean
  admin_note: string | null
}
type Seat = { id: string; member_id: string | null; login_account: string; has_password: boolean }
type Member = { member_id: string; invited_email: string; role: string }
type Company = {
  id: string
  name: string
  enterprise: boolean
  resources: Resources
  default_group_name: string
  seats: Seat[]
  members: Member[]
}

const STATUS_LABEL = { inactive: '未開通', active: '已開通', suspended: '已暫停' } as const
const STATUS_COLOR = {
  inactive: 'bg-gray-100 text-gray-600',
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-orange-100 text-orange-700',
} as const

export function CompanySocialResources() {
  const [rows, setRows] = useState<Company[]>([])
  const [drafts, setDrafts] = useState<Record<string, Resources>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/company-social-resources')
      const data = await res.json()
      if (!res.ok) return
      setRows(data.companies ?? [])
      setDrafts(Object.fromEntries((data.companies ?? []).map((c: Company) => [c.id, { ...c.resources }])))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const call = async (method: 'PATCH' | 'POST', body: Record<string, unknown>, id: string) => {
    setBusy(id)
    try {
      const res = await fetch('/api/admin/company-social-resources', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { alert(data.error ?? '操作失敗'); return false }
      if (data.charged !== undefined) alert(data.charged ? `已開通並扣款 ${data.charged} 點` : '已開通（企業版附贈，不扣點）')
      await load()
      return true
    } finally {
      setBusy(null)
    }
  }

  const setDraft = (id: string, patch: Partial<Resources>) => setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  const input = 'w-full rounded-md border px-2 py-1 text-xs'
  const shown = rows.filter(c => !filter || c.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="搜尋公司名稱" className="rounded-md border px-3 py-1.5 text-sm w-64" />
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{loading ? '載入中…' : `共 ${shown.length} 家`}</span>
          <button onClick={load} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
            <RefreshCw className="h-3.5 w-3.5" /> 重新整理
          </button>
        </div>
      </div>

      {shown.map(c => {
        const d = drafts[c.id] ?? c.resources
        const r = c.resources
        const managed = d.adspower_mode === 'managed'
        return (
          <div key={c.id} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-gray-900">
                {c.name}
                {c.enterprise && <span className="ml-2 text-[11px] rounded-full px-2 py-0.5 bg-violet-100 text-violet-700">企業版（附贈）</span>}
              </div>
              <span className={`text-xs rounded-full px-2 py-1 ${STATUS_COLOR[r.status]}`}>
                {r.adspower_mode === 'managed' ? STATUS_LABEL[r.status] : '自備 AdsPower'}
                {r.status === 'active' && r.paid_until ? `・至 ${new Date(r.paid_until).toLocaleDateString('zh-TW')}` : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
              <label className="space-y-1"><span className="text-gray-500">ISP IP 附贈</span>
                <input type="number" min={0} className={input} value={d.isp_gift} onChange={e => setDraft(c.id, { isp_gift: Number(e.target.value) })} /></label>
              <label className="space-y-1"><span className="text-gray-500">住宅 IP 附贈</span>
                <input type="number" min={0} className={input} value={d.residential_gift} onChange={e => setDraft(c.id, { residential_gift: Number(e.target.value) })} /></label>
              <label className="space-y-1"><span className="text-gray-500">AdsPower</span>
                <select className={input} value={d.adspower_mode} onChange={e => setDraft(c.id, { adspower_mode: e.target.value as Resources['adspower_mode'] })}>
                  <option value="own">自備（獨立使用）</option>
                  <option value="managed">共享代管</option>
                </select></label>
              <label className="space-y-1"><span className="text-gray-500">環境數</span>
                <input type="number" min={1} disabled={!managed} className={input} value={d.env_quota} onChange={e => setDraft(c.id, { env_quota: Number(e.target.value) })} /></label>
              <label className="space-y-1"><span className="text-gray-500">成員席次</span>
                <input type="number" min={1} disabled={!managed} className={input} value={d.member_seats} onChange={e => setDraft(c.id, { member_seats: Number(e.target.value) })} /></label>
              <label className="space-y-1"><span className="text-gray-500">付款週期</span>
                <select disabled={!managed} className={input} value={d.billing_cycle} onChange={e => setDraft(c.id, { billing_cycle: e.target.value as BillingCycle })}>
                  <option value="annual">年付</option>
                  <option value="monthly">月付</option>
                </select></label>
              <label className="space-y-1"><span className="text-gray-500">分組名稱</span>
                <input disabled={!managed} className={`${input} font-mono`} value={d.group_name ?? ''} placeholder={c.default_group_name} onChange={e => setDraft(c.id, { group_name: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-gray-500">備註</span>
                <input className={input} value={d.admin_note ?? ''} onChange={e => setDraft(c.id, { admin_note: e.target.value })} /></label>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {managed && (
                <span className="text-gray-600">
                  {c.enterprise
                    ? '企業版附贈，不扣點'
                    : `每月 ${companyMonthlyPrice(d.env_quota, d.member_seats, d.billing_cycle)} 點・每期扣 ${companyPeriodPrice(d.env_quota, d.member_seats, d.billing_cycle)} 點`}
                </span>
              )}
              {managed && (
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={d.auto_renew} onChange={e => setDraft(c.id, { auto_renew: e.target.checked })} />自動續費
                </label>
              )}
              <div className="ml-auto flex gap-2">
                <button disabled={busy === c.id} onClick={() => call('PATCH', { company_id: c.id, ...d }, c.id)}
                  className="rounded-lg border px-3 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-50">
                  {busy === c.id && <Loader2 className="inline h-3 w-3 animate-spin mr-1" />}儲存
                </button>
                {managed && r.status !== 'active' && (
                  <button disabled={busy === c.id} onClick={() => call('PATCH', { company_id: c.id, ...d, action: 'activate' }, c.id)}
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 font-medium disabled:opacity-50">
                    {r.status === 'suspended' ? '重新開通' : '開通代管'}
                  </button>
                )}
                {r.status === 'active' && (
                  <button disabled={busy === c.id} onClick={() => confirm('確定暫停此公司的共享代管？') && call('PATCH', { company_id: c.id, action: 'suspend' }, c.id)}
                    className="rounded-lg border border-rose-200 text-rose-600 px-3 py-1.5 font-medium hover:bg-rose-50 disabled:opacity-50">
                    暫停
                  </button>
                )}
              </div>
            </div>

            {managed && <SeatList company={c} busy={busy === c.id} onCall={(body) => call('POST', { company_id: c.id, ...body }, c.id)} />}
          </div>
        )
      })}
      {!loading && shown.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">沒有公司</div>}
    </div>
  )
}

function SeatList({ company, busy, onCall }: {
  company: Company
  busy: boolean
  onCall: (body: Record<string, unknown>) => Promise<boolean>
}) {
  const [adding, setAdding] = useState({ login_account: '', login_password: '', member_id: '' })
  const input = 'rounded-md border px-2 py-1 text-xs'
  const memberLabel = (id: string | null) => company.members.find(m => m.member_id === id)?.invited_email ?? '未指派'

  return (
    <div className="border-t pt-3 space-y-2 text-xs">
      <div className="font-medium text-gray-700">AdsPower 成員席次（{company.seats.length}／{company.resources.member_seats}）</div>
      {company.seats.map(s => (
        <div key={s.id} className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{s.login_account}</span>
          <span className="text-gray-400">{s.has_password ? '已設密碼' : '未設密碼'}</span>
          <select className={input} defaultValue={s.member_id ?? ''} disabled={busy}
            onChange={e => onCall({ seat: { id: s.id, login_account: s.login_account, member_id: e.target.value || null } })}>
            <option value="">未指派</option>
            {company.members.map(m => <option key={m.member_id} value={m.member_id}>{m.invited_email}（{m.role}）</option>)}
          </select>
          <span className="text-gray-500">→ {memberLabel(s.member_id)}</span>
          <button disabled={busy} onClick={() => confirm('刪除此席次？') && onCall({ seat: { delete: s.id } })} className="text-gray-400 hover:text-rose-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {company.seats.length < company.resources.member_seats && (
        <div className="flex flex-wrap items-center gap-2">
          <input className={input} placeholder="成員登入帳號" value={adding.login_account} onChange={e => setAdding({ ...adding, login_account: e.target.value })} />
          <input className={input} type="password" autoComplete="new-password" placeholder="密碼" value={adding.login_password} onChange={e => setAdding({ ...adding, login_password: e.target.value })} />
          <select className={input} value={adding.member_id} onChange={e => setAdding({ ...adding, member_id: e.target.value })}>
            <option value="">指派給（選填）</option>
            {company.members.map(m => <option key={m.member_id} value={m.member_id}>{m.invited_email}</option>)}
          </select>
          <button disabled={busy || !adding.login_account.trim()}
            onClick={async () => {
              if (await onCall({ seat: { ...adding, member_id: adding.member_id || null } })) setAdding({ login_account: '', login_password: '', member_id: '' })
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 text-white px-2.5 py-1 font-medium disabled:opacity-50">
            <Plus className="h-3 w-3" />新增席次
          </button>
        </div>
      )}
    </div>
  )
}
