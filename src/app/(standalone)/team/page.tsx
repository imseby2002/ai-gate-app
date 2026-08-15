'use client'
import { useEffect, useState, useCallback } from 'react'
import { UserPlus, Trash2, Building2, Check, Loader2, Users } from 'lucide-react'

type Scope = 'booking' | 'cs'
type Role = 'admin' | 'manager' | 'viewer'

const MODULE_LABEL: Record<Scope, string> = { booking: '訂房', cs: '客服' }
const ROLE_LABEL: Record<Role, string> = {
  admin: '管理員（含設定）',
  manager: '一般管理（不可改設定）',
  viewer: '唯讀',
}
const ROLE_SHORT: Record<Role, string> = { admin: '管理員', manager: '一般管理', viewer: '唯讀' }

type ScopeInfo = { id: string; role: Role; status: string; canCorrectAi: boolean }
type Member = {
  email: string
  member: { email: string | null; full_name: string | null } | null
  scopes: Partial<Record<Scope, ScopeInfo>>
}
type Membership = {
  owner_id: string
  owner: { email: string | null; full_name: string | null } | null
  scopes: Partial<Record<Scope, Role>>
}

function readActiveOwner(): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(/(?:^|;\s*)active_bnb_owner=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

export default function TeamPage() {
  const [self, setSelf] = useState<{ id: string; email: string | null } | null>(null)
  const [ownerModules, setOwnerModules] = useState<Scope[]>([])
  const [managing, setManaging] = useState<Member[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  // 每個模組：是否勾選 + 角色
  const [pick, setPick] = useState<Record<Scope, { on: boolean; role: Role }>>({
    booking: { on: true, role: 'manager' },
    cs: { on: true, role: 'manager' },
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [active, setActive] = useState('')
  // ?scope=cs / ?scope=booking → 只處理單一模組（客服或訂房單獨邀請）
  const [scopeParam, setScopeParam] = useState<Scope | ''>('')

  useEffect(() => {
    setActive(readActiveOwner())
    const sp = new URLSearchParams(window.location.search).get('scope')
    if (sp === 'cs' || sp === 'booking') setScopeParam(sp)
  }, [])

  const visibleModules = scopeParam ? ownerModules.filter(m => m === scopeParam) : ownerModules
  const onlyScope: Scope[] = scopeParam ? [scopeParam] : (['booking', 'cs'] as Scope[])
  const visibleManaging = scopeParam ? managing.filter(m => m.scopes[scopeParam]) : managing

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/collab/members')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || '載入失敗')
      setSelf(d.self)
      setOwnerModules(d.ownerModules ?? [])
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
      const modules: Partial<Record<Scope, Role>> = {}
      for (const s of visibleModules) if (pick[s].on) modules[s] = pick[s].role
      if (Object.keys(modules).length === 0) throw new Error('請至少勾選一個模組')
      const r = await fetch('/api/collab/members', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, modules }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || '邀請失敗')
      setEmail('')
      await load()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  async function changeRole(id: string, role: Role) {
    await fetch('/api/collab/members', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role }),
    })
    await load()
  }

  async function changeCanCorrectAi(id: string, canCorrectAi: boolean) {
    await fetch('/api/collab/members', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, canCorrectAi }),
    })
    await load()
  }

  async function removeScope(id: string) {
    await fetch('/api/collab/members', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  async function removePerson(personEmail: string) {
    if (!confirm('移除此協作者的所有模組權限？')) return
    await fetch('/api/collab/members', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: personEmail }),
    })
    await load()
  }

  async function switchOwner(ownerId: string) {
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
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-5 w-5" />{scopeParam ? `${MODULE_LABEL[scopeParam]}協作成員` : '協作成員'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {scopeParam === 'cs'
            ? '邀請夥伴一起回覆客服收件匣；可分權管理，也可切換到你協助的對象。'
            : scopeParam === 'booking'
            ? '邀請夥伴一起管理訂房；可分權管理，也可切換到你協助的對象。'
            : '邀請夥伴一起管理你的訂房與客服；可分別授權，也可切換到你協助的對象。'}
        </p>
      </div>

      {/* 我參與協作的對象（切換器） */}
      {(memberships.length > 0 || !selfActive) && (
        <section className="bg-white border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">目前操作中的帳號</h2>
          <div className="flex flex-col gap-2">
            <button onClick={() => switchOwner(self?.id ?? '')}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors
                ${selfActive ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'}`}>
              <span className="flex items-center gap-2"><Building2 className="h-4 w-4" />我自己的帳號</span>
              {selfActive && <Check className="h-4 w-4" />}
            </button>
            {memberships.map(m => {
              const on = active === m.owner_id
              const scopeText = (Object.entries(m.scopes) as [Scope, Role][])
                .map(([s, r]) => `${MODULE_LABEL[s]}·${ROLE_SHORT[r]}`).join('，')
              return (
                <button key={m.owner_id} onClick={() => switchOwner(m.owner_id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors
                    ${on ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {m.owner?.full_name || m.owner?.email || m.owner_id.slice(0, 8)}
                    <span className="text-xs text-gray-400">（{scopeText}）</span>
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
        <h2 className="text-sm font-semibold text-gray-700 mb-3">邀請協作者</h2>
        {visibleModules.length === 0 ? (
          <p className="text-sm text-gray-400">你目前沒有可邀請協作的模組（需先開通{scopeParam ? MODULE_LABEL[scopeParam] : '訂房或客服'}）。</p>
        ) : (
          <form onSubmit={invite} className="space-y-3">
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="對方 Email" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none" />
            <div className="space-y-2">
              {visibleModules.map(s => (
                <div key={s} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 w-24 text-sm cursor-pointer">
                    <input type="checkbox" checked={pick[s].on}
                      onChange={e => setPick(p => ({ ...p, [s]: { ...p[s], on: e.target.checked } }))} />
                    {MODULE_LABEL[s]}
                  </label>
                  <select value={pick[s].role} disabled={!pick[s].on}
                    onChange={e => setPick(p => ({ ...p, [s]: { ...p[s], role: e.target.value as Role } }))}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm bg-white disabled:opacity-40">
                    {(['admin', 'manager', 'viewer'] as Role[]).map(r => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button type="submit" disabled={busy}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}送出邀請
            </button>
            {visibleModules.length === 1 && (
              <p className="text-xs text-gray-400">此處只邀請「{MODULE_LABEL[visibleModules[0]]}」模組的協作。</p>
            )}
            <p className="text-xs text-gray-400">對方用此 Email 登入後會自動加入。尚未註冊也可先邀請。</p>
            {err && <p className="text-xs text-red-500">{err}</p>}
          </form>
        )}
      </section>

      {/* 協作者列表 */}
      <section className="bg-white border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">協作者</h2>
        {loading ? (
          <div className="text-sm text-gray-400 py-6 text-center">載入中…</div>
        ) : visibleManaging.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">尚無協作者，邀請第一位夥伴吧。</div>
        ) : (
          <div className="divide-y">
            {visibleManaging.map(m => {
              const anyActive = Object.values(m.scopes).some(s => s?.status === 'active')
              return (
                <div key={m.email} className="py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 truncate">{m.member?.full_name || m.member?.email || m.email}</div>
                      <div className="text-xs text-gray-400 truncate">{m.email}</div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0
                      ${anyActive ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                      {anyActive ? '已加入' : '待加入'}
                    </span>
                    <button onClick={() => removePerson(m.email)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0" title="移除全部">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-0">
                    {onlyScope.map(s => {
                      const info = m.scopes[s]
                      if (!info) return null
                      return (
                        <div key={s} className="flex items-center gap-1.5 bg-gray-50 border rounded-lg px-2 py-1">
                          <span className="text-xs text-gray-600">{MODULE_LABEL[s]}</span>
                          <select value={info.role} onChange={e => changeRole(info.id, e.target.value as Role)}
                            className="text-xs px-1.5 py-0.5 border rounded bg-white">
                            {(['admin', 'manager', 'viewer'] as Role[]).map(r => (
                              <option key={r} value={r}>{ROLE_SHORT[r]}</option>
                            ))}
                          </select>
                          {s === 'cs' && info.role !== 'viewer' && (
                            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer" title="授權後，這位夥伴可以在客服工作台直接提交「AI 回答修正」，立即生效">
                              <input type="checkbox" checked={info.canCorrectAi}
                                onChange={e => changeCanCorrectAi(info.id, e.target.checked)} />
                              可修正 AI
                            </label>
                          )}
                          <button onClick={() => removeScope(info.id)}
                            className="text-gray-300 hover:text-red-500" title={`移除${MODULE_LABEL[s]}權限`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
