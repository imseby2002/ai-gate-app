'use client'
import { useEffect, useState, useCallback } from 'react'
import { UserPlus, Trash2, Building2, Check, Loader2 } from 'lucide-react'

type Role = 'admin' | 'manager' | 'viewer'
const ROLE_LABEL: Record<Role, string> = {
  admin: '管理員（完整權限）',
  manager: '一般管理（不可改設定）',
  viewer: '唯讀',
}

type Member = {
  id: string
  invited_email: string
  role: Role
  status: 'pending' | 'active' | 'revoked'
  member_id: string | null
  member: { email: string | null; full_name: string | null } | null
}
type Membership = {
  owner_id: string
  role: Role
  owner: { email: string | null; full_name: string | null } | null
}

function readActiveOwner(): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(/(?:^|;\s*)active_bnb_owner=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

export default function MembersPage() {
  const [self, setSelf] = useState<{ id: string; email: string | null } | null>(null)
  const [managing, setManaging] = useState<Member[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('manager')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [active, setActive] = useState('')

  useEffect(() => { setActive(readActiveOwner()) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/booking/members')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || '載入失敗')
      setSelf(d.self)
      setManaging(d.managing ?? [])
      setMemberships(d.memberships ?? [])
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const r = await fetch('/api/booking/members', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || '邀請失敗')
      setEmail('')
      await load()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  async function changeRole(id: string, newRole: Role) {
    await fetch('/api/booking/members', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role: newRole }),
    })
    await load()
  }

  async function remove(id: string) {
    if (!confirm('確定移除此成員 / 邀請？')) return
    await fetch('/api/booking/members', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  async function switchBnb(ownerId: string) {
    await fetch('/api/booking/active-bnb', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId }),
    })
    window.location.reload()
  }

  const selfActive = !active || active === self?.id

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">協作成員</h1>
        <p className="text-sm text-gray-500 mt-1">邀請其他人一起管理你的民宿，或切換到你協助管理的民宿。</p>
      </div>

      {/* 我參與協作的民宿（切換器） */}
      {(memberships.length > 0 || !selfActive) && (
        <section className="bg-white border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">目前管理中的民宿</h2>
          <div className="flex flex-col gap-2">
            <button onClick={() => switchBnb(self?.id ?? '')}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors
                ${selfActive ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'}`}>
              <span className="flex items-center gap-2"><Building2 className="h-4 w-4" />我自己的民宿</span>
              {selfActive && <Check className="h-4 w-4" />}
            </button>
            {memberships.map(m => {
              const on = active === m.owner_id
              return (
                <button key={m.owner_id} onClick={() => switchBnb(m.owner_id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors
                    ${on ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {m.owner?.full_name || m.owner?.email || m.owner_id.slice(0, 8)}
                    <span className="text-xs text-gray-400">（{ROLE_LABEL[m.role]}）</span>
                  </span>
                  {on && <Check className="h-4 w-4" />}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* 邀請表單 */}
      <section className="bg-white border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">邀請成員加入「我的民宿」</h2>
        <form onSubmit={invite} className="flex flex-col sm:flex-row gap-2">
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="對方 Email" className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none" />
          <select value={role} onChange={e => setRole(e.target.value as Role)}
            className="px-3 py-2 border rounded-lg text-sm bg-white">
            <option value="admin">管理員</option>
            <option value="manager">一般管理</option>
            <option value="viewer">唯讀</option>
          </select>
          <button type="submit" disabled={busy}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}邀請
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2">對方用此 Email 登入後會自動加入。尚未註冊也可先邀請。</p>
        {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
      </section>

      {/* 成員列表 */}
      <section className="bg-white border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">成員列表</h2>
        {loading ? (
          <div className="text-sm text-gray-400 py-6 text-center">載入中…</div>
        ) : managing.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">尚無成員，邀請第一位夥伴吧。</div>
        ) : (
          <div className="divide-y">
            {managing.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">
                    {m.member?.full_name || m.member?.email || m.invited_email}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {m.status === 'pending' ? `待加入 · ${m.invited_email}` : m.invited_email}
                  </div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0
                  ${m.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                  {m.status === 'active' ? '已加入' : '待加入'}
                </span>
                <select value={m.role} onChange={e => changeRole(m.id, e.target.value as Role)}
                  className="text-xs px-2 py-1 border rounded-lg bg-white shrink-0">
                  <option value="admin">管理員</option>
                  <option value="manager">一般管理</option>
                  <option value="viewer">唯讀</option>
                </select>
                <button onClick={() => remove(m.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
