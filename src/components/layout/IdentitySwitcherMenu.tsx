'use client'

import { useEffect, useState } from 'react'
import { Building2, Check, Loader2, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'

type Scope = 'booking' | 'cs'
type Role = 'admin' | 'manager' | 'viewer'
type BnbMembership = { owner_id: string; owner: { email: string | null; full_name: string | null } | null; scopes: Partial<Record<Scope, Role>> }
type CompanyMembership = { company_id: string; role: string; company_name: string | null; bnb_owner_id: string | null }

function readCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : ''
}

// 右上角帳號選單裡的「身分/協作」快速切換區塊：把 /team 頁兩個切換器的精簡版
// 搬到隨處可見的地方，不用先跑去團隊頁才能切換。完整的邀請/角色管理仍留在 /team。
export function IdentitySwitcherMenu({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('Team')
  const [loading, setLoading] = useState(true)
  const [selfId, setSelfId] = useState('')
  const [activeOwner, setActiveOwner] = useState('')
  const [activeCompany, setActiveCompany] = useState('')
  const [memberships, setMemberships] = useState<BnbMembership[]>([])
  const [companyMemberships, setCompanyMemberships] = useState<CompanyMembership[]>([])
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    setActiveOwner(readCookie('active_bnb_owner'))
    setActiveCompany(readCookie('active_company_id'))
    Promise.all([
      fetch('/api/collab/members').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/company/memberships').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([collab, company]) => {
      if (collab) { setSelfId(collab.self?.id ?? ''); setMemberships(collab.memberships ?? []) }
      if (company) setCompanyMemberships(company.memberships ?? [])
      setLoading(false)
    })
  }, [])

  const companyBnbOwnerIds = new Set(companyMemberships.map(m => m.bnb_owner_id).filter(Boolean))
  const visibleMemberships = memberships.filter(m => !companyBnbOwnerIds.has(m.owner_id))
  const selfActive = !activeOwner || activeOwner === selfId

  async function switchOwner(ownerId: string) {
    setSwitching(true)
    await fetch('/api/booking/active-bnb', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId }),
    })
    window.location.reload()
  }

  async function switchCompany(companyId: string) {
    setSwitching(true)
    await fetch('/api/company/active-company', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: companyId || null }),
    })
    window.location.reload()
  }

  if (loading) {
    return <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
  }

  if (memberships.length === 0 && companyMemberships.length === 0) return null

  return (
    <div className="py-1">
      <p className="px-3 pb-1 text-[11px] font-semibold text-muted-foreground tracking-wide">{t('identityCollabHeader')}</p>
      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => switchOwner(selfId)}
          disabled={switching}
          className={`flex items-center justify-between gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50
            ${selfActive ? 'text-primary bg-primary/10' : 'hover:bg-accent'}`}
        >
          <span className="flex items-center gap-2 truncate"><Users className="h-3.5 w-3.5 shrink-0" />{t('myOwnAccount')}</span>
          {selfActive && <Check className="h-3.5 w-3.5 shrink-0" />}
        </button>

        {companyMemberships.map(m => {
          const on = activeCompany === m.company_id
          return (
            <button key={m.company_id} onClick={() => switchCompany(m.company_id)} disabled={switching}
              className={`flex items-center justify-between gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50
                ${on ? 'text-primary bg-primary/10' : 'hover:bg-accent'}`}>
              <span className="flex items-center gap-2 truncate">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{m.company_name || m.company_id.slice(0, 8)}</span>
              </span>
              {on && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          )
        })}

        {visibleMemberships.map(m => {
          const on = activeOwner === m.owner_id
          return (
            <button key={m.owner_id} onClick={() => switchOwner(m.owner_id)} disabled={switching}
              className={`flex items-center justify-between gap-2 w-full px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50
                ${on ? 'text-primary bg-primary/10' : 'hover:bg-accent'}`}>
              <span className="flex items-center gap-2 truncate">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{m.owner?.full_name || m.owner?.email || m.owner_id.slice(0, 8)}</span>
              </span>
              {on && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          )
        })}
      </div>
      <a href="/team" onClick={onNavigate}
        className="block mt-1 px-3 py-1.5 text-xs text-primary hover:underline">
        {t('manageCollabLink')} →
      </a>
      <div className="mt-1.5 border-t" />
    </div>
  )
}
