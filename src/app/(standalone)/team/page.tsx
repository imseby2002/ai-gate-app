'use client'
import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { UserPlus, Trash2, Building2, Check, Loader2, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Scope = 'booking' | 'cs'
type Role = 'admin' | 'manager' | 'viewer'

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
type CompanyMembership = { company_id: string; role: string; company_name: string | null; bnb_owner_id: string | null }

function readCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : ''
}

export default function TeamPage() {
  const t = useTranslations('Team')
  const MODULE_LABEL: Record<Scope, string> = { booking: t('moduleBooking'), cs: t('moduleCs') }
  const ROLE_LABEL: Record<Role, string> = {
    admin: t('roleAdminFull'),
    manager: t('roleManagerFull'),
    viewer: t('roleViewerFull'),
  }
  const ROLE_SHORT: Record<Role, string> = { admin: t('roleAdmin'), manager: t('roleManager'), viewer: t('roleViewer') }
  const COMPANY_ROLE_SHORT: Record<string, string> = { owner: t('companyRoleOwner'), admin: t('roleAdmin'), manager: t('roleManager'), viewer: t('roleViewer') }
  const [ownerModules, setOwnerModules] = useState<Scope[]>([])
  const [canManage, setCanManage] = useState(true)
  const [managing, setManaging] = useState<Member[]>([])
  const [companyTeam, setCompanyTeam] = useState<{ companyName: string; members: { email: string; full_name: string | null; role: string }[] } | null>(null)
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
  const [activeBooking, setActiveBooking] = useState('')
  const [activeCs, setActiveCs] = useState('')
  const [companyMemberships, setCompanyMemberships] = useState<CompanyMembership[]>([])
  const [activeCompany, setActiveCompany] = useState('')
  const [switchingCompany, setSwitchingCompany] = useState(false)
  const [switchingOwner, setSwitchingOwner] = useState(false)
  // ?scope=cs / ?scope=booking → 只處理單一模組（客服或訂房單獨邀請）
  const [scopeParam, setScopeParam] = useState<Scope | ''>('')

  useEffect(() => {
    setActiveBooking(readCookie('active_bnb_owner_booking'))
    setActiveCs(readCookie('active_bnb_owner_cs'))
    setActiveCompany(readCookie('active_company_id'))
    const sp = new URLSearchParams(window.location.search).get('scope')
    if (sp === 'cs' || sp === 'booking') setScopeParam(sp)
  }, [])

  const loadCompanies = useCallback(async () => {
    try {
      const r = await fetch('/api/company/memberships')
      const d = await r.json()
      if (r.ok) setCompanyMemberships(d.memberships ?? [])
    } catch { /* 靜默失敗：不影響身分卡片其餘部分 */ }
  }, [])

  useEffect(() => { loadCompanies() }, [loadCompanies])

  async function switchCompany(companyId: string) {
    setSwitchingCompany(true)
    try {
      const r = await fetch('/api/company/active-company', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: companyId || null }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || t('switchCompanyFailed')) }
      window.location.reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setSwitchingCompany(false)
    }
  }

  async function switchOwner(ownerId: string, scope: Scope) {
    setSwitchingOwner(true)
    try {
      const r = await fetch('/api/booking/active-bnb', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId, scope }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || t('switchCompanyFailed')) }
      window.location.reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setSwitchingOwner(false)
    }
  }

  const visibleModules = scopeParam ? ownerModules.filter(m => m === scopeParam) : ownerModules
  const onlyScope: Scope[] = scopeParam ? [scopeParam] : (['booking', 'cs'] as Scope[])
  const visibleManaging = scopeParam ? managing.filter(m => m.scopes[scopeParam]) : managing
  // 公司若有掛訂房/客服帳號，切公司會自動連動訂房/客服，不用在下面協作邀請清單重複列一次
  const companyBnbOwnerIds = new Set(companyMemberships.map(m => m.bnb_owner_id).filter(Boolean))
  const csMemberships = memberships.filter(m => m.scopes.cs && !companyBnbOwnerIds.has(m.owner_id))
  const bookingMemberships = memberships.filter(m => m.scopes.booking && !companyBnbOwnerIds.has(m.owner_id))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/collab/members')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || t('loadFailed'))
      setOwnerModules(d.ownerModules ?? [])
      setCanManage(d.canManage ?? true)
      setManaging(d.managing ?? [])
      setCompanyTeam(d.companyTeam ?? null)
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
      if (Object.keys(modules).length === 0) throw new Error(t('selectAtLeastOne'))
      const r = await fetch('/api/collab/members', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, modules, scope: scopeParam || 'booking' }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || t('inviteFailed'))
      setEmail('')
      await load()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  async function changeRole(id: string, role: Role, scope: Scope) {
    await fetch('/api/collab/members', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role, scope }),
    })
    await load()
  }

  async function changeCanCorrectAi(id: string, canCorrectAi: boolean, scope: Scope) {
    await fetch('/api/collab/members', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, canCorrectAi, scope }),
    })
    await load()
  }

  async function removeScope(id: string, scope: Scope) {
    await fetch('/api/collab/members', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, scope }),
    })
    await load()
  }

  async function removePerson(personEmail: string) {
    if (!confirm(t('confirmRemovePerson'))) return
    await fetch('/api/collab/members', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: personEmail, scope: scopeParam || 'booking' }),
    })
    await load()
  }

  function collabCard(scope: Scope, list: Membership[]) {
    const active = scope === 'booking' ? activeBooking : activeCs
    return (
      <Card key={scope} className="p-4">
        <h2 className="text-sm font-semibold mb-1">{scope === 'cs' ? t('csCollabHeader') : t('bookingCollabHeader')}</h2>
        <p className="text-xs text-muted-foreground mb-2">{t('collabSubtitle')}</p>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{t('noCollabInvites')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map(m => {
              const on = active === m.owner_id
              const role = m.scopes[scope]
              return (
                <button key={m.owner_id} onClick={() => switchOwner(m.owner_id, scope)} disabled={switchingOwner}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors disabled:opacity-50
                    ${on ? 'border-primary/30 bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {m.owner?.full_name || m.owner?.email || m.owner_id.slice(0, 8)}
                    {role && <span className="text-xs text-muted-foreground">（{ROLE_SHORT[role]}）</span>}
                  </span>
                  {on && <Check className="h-4 w-4" />}
                </button>
              )
            })}
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Users className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{scopeParam ? t('titleScoped', { module: MODULE_LABEL[scopeParam] }) : t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {scopeParam === 'cs'
              ? t('subtitleCs')
              : scopeParam === 'booking'
              ? t('subtitleBooking')
              : t('subtitleAll')}
          </p>
        </div>
      </div>

      {/* 目前操作身分：以員工身分整個公司一起切（ERP/CS/訂房/行銷全包），或個人身分 */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-1">{t('identityHeader')}</h2>
        <p className="text-xs text-muted-foreground mb-3">{t('companySubtitle')}</p>
        <div className="flex flex-col gap-2">
          <button onClick={() => switchCompany('')} disabled={switchingCompany}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors disabled:opacity-50
              ${!activeCompany ? 'border-primary/30 bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
            <span className="flex items-center gap-2"><Users className="h-4 w-4" />{t('personalAccountOption')}</span>
            {!activeCompany && <Check className="h-4 w-4" />}
          </button>
          {companyMemberships.map(m => {
            const on = activeCompany === m.company_id
            return (
              <button key={m.company_id} onClick={() => switchCompany(m.company_id)} disabled={switchingCompany}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors disabled:opacity-50
                  ${on ? 'border-primary/30 bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {m.company_name || m.company_id.slice(0, 8)}
                  <span className="text-xs text-muted-foreground">（{COMPANY_ROLE_SHORT[m.role] ?? m.role}）</span>
                </span>
                {on && <Check className="h-4 w-4" />}
              </button>
            )
          })}
        </div>
      </Card>

      {/* 客服／訂房協作邀請：只顯示別人邀請你協作的項目，不能自己新增，跟上面的身分各自獨立 */}
      {(!scopeParam || scopeParam === 'cs') && collabCard('cs', csMemberships)}
      {(!scopeParam || scopeParam === 'booking') && collabCard('booking', bookingMemberships)}

      {/* 邀請表單 */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">{t('inviteCollaborator')}</h2>
        {!canManage ? (
          <p className="text-sm text-muted-foreground">{t('noManagePermission')}</p>
        ) : visibleModules.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noInvitableModules', { module: scopeParam ? MODULE_LABEL[scopeParam] : t('bookingOrCs') })}</p>
        ) : (
          <form onSubmit={invite} className="space-y-3">
            <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={t('theirEmail')} />
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
                    className="flex-1 px-3 py-2 border rounded-lg text-sm bg-card disabled:opacity-40">
                    {(['admin', 'manager', 'viewer'] as Role[]).map(r => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <Button type="submit" disabled={busy} size="sm" className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{t('sendInvite')}
            </Button>
            {visibleModules.length === 1 && (
              <p className="text-xs text-muted-foreground">{t('onlyThisModule', { module: MODULE_LABEL[visibleModules[0]] })}</p>
            )}
            <p className="text-xs text-muted-foreground">{t('inviteNote')}</p>
            {err && <p className="text-xs text-destructive">{err}</p>}
          </form>
        )}
      </Card>

      {/* 協作者列表 */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">{t('collaborators')}</h2>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !canManage ? (
          <div className="text-sm text-muted-foreground py-6 text-center">{t('noManagePermission')}</div>
        ) : visibleManaging.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">{t('noCollaborators')}</div>
        ) : (
          <div className="divide-y">
            {visibleManaging.map(m => {
              const anyActive = Object.values(m.scopes).some(s => s?.status === 'active')
              return (
                <div key={m.email} className="py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{m.member?.full_name || m.member?.email || m.email}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0
                      ${anyActive ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {anyActive ? t('joined') : t('pending')}
                    </span>
                    <button onClick={() => removePerson(m.email)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0" title={t('removeAll')}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-0">
                    {onlyScope.map(s => {
                      const info = m.scopes[s]
                      if (!info) return null
                      return (
                        <div key={s} className="flex items-center gap-1.5 bg-muted border rounded-lg px-2 py-1">
                          <span className="text-xs text-muted-foreground">{MODULE_LABEL[s]}</span>
                          <select value={info.role} onChange={e => changeRole(info.id, e.target.value as Role, s)}
                            className="text-xs px-1.5 py-0.5 border rounded bg-card">
                            {(['admin', 'manager', 'viewer'] as Role[]).map(r => (
                              <option key={r} value={r}>{ROLE_SHORT[r]}</option>
                            ))}
                          </select>
                          {s === 'cs' && info.role !== 'viewer' && (
                            <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer" title={t('canCorrectAiTitle')}>
                              <input type="checkbox" checked={info.canCorrectAi}
                                onChange={e => changeCanCorrectAi(info.id, e.target.checked, s)} />
                              {t('canCorrectAi')}
                            </label>
                          )}
                          <button onClick={() => removeScope(info.id, s)}
                            className="text-muted-foreground hover:text-destructive" title={t('removeModulePermission', { module: MODULE_LABEL[s] })}>
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
      </Card>

      {/* 該業務所屬公司的 ERP 團隊（唯讀，避免跟上面的訂房/客服協作者重複邀請） */}
      {canManage && companyTeam && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">{t('companyTeam', { company: companyTeam.companyName })}</h2>
          {companyTeam.members.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">{t('companyTeamEmpty')}</div>
          ) : (
            <div className="divide-y">
              {companyTeam.members.map(m => (
                <div key={m.email} className="py-2.5 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{m.full_name || m.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{COMPANY_ROLE_SHORT[m.role] ?? m.role}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
