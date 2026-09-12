'use client'

import { useState, useEffect, type ComponentType } from 'react'
import Link from 'next/link'
import {
  Building2, Loader2, ChevronRight, ShieldCheck, ArrowUpRight, ArrowRight, ExternalLink,
  Users, Wallet, FlaskConical, Store, Briefcase, Wrench, Crown, LayoutGrid, Megaphone,
  Lightbulb, Scale,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UNIT_AREAS, COMMON_PAGES, UNIT_LABEL, hasUnit } from '@/lib/org-units'
import { OfficeProposalsPanel } from '@/components/office/OfficeProposalsPanel'

interface Access {
  isAdmin: boolean
  isCompanyAdmin?: boolean
  canManage?: boolean
  companyRole?: string | null
  companyName?: string | null
  units: string[]
}
interface UserRow { id: string; full_name: string | null; email: string | null; user_type: string; units: string[] | null; store_code?: string | null }

// 各單位的圖示與主題色（class 為完整字串，讓 Tailwind 能靜態掃描）
const UNIT_STYLE: Record<string, { icon: ComponentType<{ className?: string }>; chip: string; ring: string }> = {
  hr:        { icon: Users,        chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',          ring: 'hover:border-blue-400/60' },
  finance:   { icon: Wallet,       chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', ring: 'hover:border-emerald-400/60' },
  rd:        { icon: FlaskConical, chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',      ring: 'hover:border-violet-400/60' },
  store:     { icon: Store,        chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',        ring: 'hover:border-amber-400/60' },
  affairs:   { icon: Briefcase,    chip: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',           ring: 'hover:border-cyan-400/60' },
  audit:     { icon: ShieldCheck,  chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',           ring: 'hover:border-rose-400/60' },
  repair:    { icon: Wrench,       chip: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',     ring: 'hover:border-orange-400/60' },
  gm:        { icon: Crown,        chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',     ring: 'hover:border-indigo-400/60' },
  marketing: { icon: Megaphone,    chip: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',           ring: 'hover:border-pink-400/60' },
  mkt:       { icon: Megaphone,    chip: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',           ring: 'hover:border-pink-400/60' },
}
const fallbackStyle = { icon: LayoutGrid, chip: 'bg-primary/10 text-primary', ring: 'hover:border-primary/50' }

export default function OfficePage() {
  const [access, setAccess] = useState<Access | null>(null)
  const [mainTab, setMainTab] = useState<'units' | 'proposals' | 'assign'>('units')
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  const updateUrlTab = (tab: 'units' | 'proposals' | 'assign') => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (tab === 'units') {
        url.searchParams.delete('tab')
      } else {
        url.searchParams.set('tab', tab)
      }
      window.history.replaceState({}, '', url.toString())
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab === 'proposals') setMainTab('proposals')
      else if (tab === 'assign') setMainTab('assign')
    }
  }, [])

  useEffect(() => {
    fetch('/api/org/access')
      .then(r => r.ok ? r.json() : { isAdmin: false, canManage: false, units: [] })
      .then(setAccess)

    // 取得待審提案數量，供標籤角標提示
    fetch('/api/office/proposals')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && Array.isArray(d.proposals)) {
          const pending = d.proposals.filter((p: { status: string }) => p.status === 'pending').length
          setPendingCount(pending)
        }
      })
      .catch(() => {})
  }, [])

  if (!access) return <div className="flex h-full items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const canManage = access.canManage ?? access.isAdmin
  const isSuperAdmin = access.isAdmin
  const roleLabel = access.isAdmin ? '平台總管理者' : access.companyRole === 'owner' ? '公司負責人' : access.isCompanyAdmin ? '公司 IT' : null
  const visibleAreas = UNIT_AREAS
    .filter(a => isSuperAdmin || hasUnit(canManage, access.units, a.key))
    .map(a => ({ ...a, pages: a.pages.filter(p => canManage || !p.adminOnly) }))
    .filter(a => a.pages.length > 0)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">公司入口</h1>
              {access.companyName && <Badge variant="secondary" className="font-medium">{access.companyName}</Badge>}
              {roleLabel && <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" />{roleLabel}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              依單位進入各自系統。每位同仁皆可提出系統問題與改進想法，經公司負責人批准後即時啟動程式改寫。
            </p>
            {COMMON_PAGES.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium mr-1">全公司共用：</span>
                {COMMON_PAGES.map(p => {
                  const isProposals = p.href.includes('tab=proposals')
                  const isSelected = isProposals && mainTab === 'proposals'
                  return (
                    <Link
                      key={p.href}
                      href={p.href}
                      onClick={e => {
                        if (isProposals) {
                          e.preventDefault()
                          setMainTab('proposals')
                          updateUrlTab('proposals')
                        }
                      }}
                    >
                      <Button
                        variant={isSelected ? 'default' : p.href === '/units' ? 'default' : 'outline'}
                        size="sm"
                        className={`gap-1.5 rounded-full ${isSelected ? 'bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm' : p.href === '/units' ? 'shadow-sm font-medium' : 'bg-card/60 backdrop-blur'}`}
                      >
                        {p.href === '/units' && <Building2 className="h-3.5 w-3.5" />}
                        {p.href === '/legal' && <Scale className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
                        {p.label}
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                      </Button>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 導覽分頁標籤列 */}
      <div className="flex items-center justify-between border-b pb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl">
          <button
            type="button"
            onClick={() => { setMainTab('units'); updateUrlTab('units') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mainTab === 'units'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Building2 className="h-4 w-4 text-primary" />
            部門系統入口
          </button>
          <button
            type="button"
            onClick={() => { setMainTab('proposals'); updateUrlTab('proposals') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mainTab === 'proposals'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Lightbulb className="h-4 w-4 text-amber-500" />
            問題與想法提案
            {pendingCount !== null && pendingCount > 0 && (
              <Badge className="ml-1 bg-amber-500 text-white hover:bg-amber-600 px-1.5 py-0 text-[10px] font-bold">
                {pendingCount} 待審
              </Badge>
            )}
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => { setMainTab('assign'); updateUrlTab('assign') }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mainTab === 'assign'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              成員與權限指派
            </button>
          )}
        </div>

        {mainTab === 'units' && (
          <Button
            size="sm"
            onClick={() => { setMainTab('proposals'); updateUrlTab('proposals') }}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold gap-1.5 shadow-sm"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            提出問題或想法
          </Button>
        )}
      </div>

      {/* Tab 內容切換 */}
      {mainTab === 'proposals' ? (
        <OfficeProposalsPanel canManage={canManage} />
      ) : mainTab === 'assign' ? (
        canManage && (
          <AssignPanel
            isAdmin={access.isAdmin}
            isCompanyAdmin={access.isCompanyAdmin}
            companyRole={access.companyRole}
          />
        )
      ) : (
        <>
          {/* 各單位卡片 */}
          {visibleAreas.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              尚未指派任何單位，請聯繫公司負責人或 IT 管理員。
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleAreas.map(a => {
                const st = UNIT_STYLE[a.key] ?? fallbackStyle
                const Icon = st.icon
                const isMarketing = a.key === 'marketing' || a.key === 'mkt'
                return (
                  <Link
                    key={a.key}
                    href={a.homeHref}
                    className="group block focus:outline-none"
                  >
                    <Card className={`p-5 h-full flex flex-col justify-between transition-all duration-200 border hover:shadow-md hover:-translate-y-0.5 ${st.ring}`}>
                      <div>
                        {/* 頂部：圖示、部門名稱、功能數 */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 ${st.chip}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                                {a.label}
                              </h3>
                              <span className="text-[11px] text-muted-foreground font-medium">
                                {a.pages.length} 項核心功能
                              </span>
                            </div>
                          </div>

                          {isMarketing && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 shrink-0">
                              marketing
                            </span>
                          )}
                        </div>

                        {/* 部門核心職責與範疇簡述 */}
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-4">
                          {a.description}
                        </p>
                      </div>

                      {/* 底部按鈕：進入部門首頁 */}
                      <div className="pt-3 border-t flex items-center justify-between text-xs font-semibold text-primary mt-2">
                        <span className="group-hover:underline">進入{a.label}首頁</span>
                        <div className="flex items-center gap-1 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all">
                          <span className="text-[11px] font-normal">前往</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}

          {canManage && (
            <div className="mt-8">
              <AssignPanel
                isAdmin={access.isAdmin}
                isCompanyAdmin={access.isCompanyAdmin}
                companyRole={access.companyRole}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function AssignPanel({ isAdmin, isCompanyAdmin, companyRole }: { isAdmin: boolean; isCompanyAdmin?: boolean; companyRole?: string | null }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [storeList, setStoreList] = useState<Array<{ code: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/users').then(r => r.ok ? r.json() : { users: [] }),
      fetch('/api/fin/stores').then(r => r.ok ? r.json() : { stores: [] }),
    ]).then(([userData, storeData]) => {
      setUsers((userData.users ?? []).map((u: UserRow) => ({ ...u, units: u.units ?? [] })))
      setStoreList((storeData.stores ?? []).map((s: { code: string; name: string }) => ({ code: s.code, name: s.name || s.code })))
      setLoading(false)
    })
  }, [])

  const toggle = async (u: UserRow, key: string) => {
    const cur = u.units ?? []
    const isMkt = key === 'marketing' || key === 'mkt'
    let next: string[]
    if (isMkt) {
      const has = cur.includes('marketing') || cur.includes('mkt')
      next = has ? cur.filter(x => x !== 'marketing' && x !== 'mkt') : [...cur, 'marketing', 'mkt']
    } else {
      next = cur.includes(key) ? cur.filter(x => x !== key) : [...cur, key]
    }
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, units: next } : x))
    setSaving(u.id)
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: u.id, units: next }) })
    setSaving('')
  }

  const changeStore = async (u: UserRow, newStoreCode: string) => {
    const code = newStoreCode.trim() || null
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, store_code: code } : x))
    setSaving(u.id)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id, store_code: code }),
    })
    setSaving('')
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <div className="text-sm font-semibold flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          人員名單與單位權限指派
        </div>
        <Link href="/personnel">
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            人員名冊 / 批次匯入 <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          由公司負責人或 IT 維護人員名單與單位授權；勾選每位帳號可存取的單位。若指定「所屬門市」，該門市人員登入後將自動鎖定為該門市，無法切換或存取其他門市資料。
          {isCompanyAdmin && `（目前以「${companyRole === 'owner' ? '公司負責人' : '公司 IT'}」身分管理本公司成員）`}
        </p>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : users.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">本公司尚無其他成員帳號，請前往「人事管理」或設定進行邀請。</div>
          ) : <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-muted-foreground border-b">
                  <th className="py-2.5 px-3 font-medium sticky left-0 bg-muted/50">帳號</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap text-left">所屬門市 (Store 鎖定)</th>
                  {UNIT_AREAS.map(a => <th key={a.key} className="px-2 text-center font-medium whitespace-nowrap">{a.label}</th>)}
                </tr>
              </thead>
              <tbody>{users.map(u => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-3 sticky left-0 bg-card">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{u.full_name || u.email || u.id.slice(0, 8)}</span>
                      {u.user_type === 'admin' && <Badge variant="success" className="px-1.5 py-0 text-[10px]">管理者</Badge>}
                      {saving === u.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </div>
                    {u.email && <div className="text-[11px] text-muted-foreground">{u.email}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <select
                      value={u.store_code || ''}
                      onChange={e => changeStore(u, e.target.value)}
                      disabled={u.user_type === 'admin' && !isAdmin}
                      className="h-8 rounded-md border bg-background px-2 text-xs font-medium focus:ring-1 focus:ring-primary disabled:opacity-50"
                    >
                      <option value="">總部 / 全門市（不鎖定）</option>
                      {storeList.map(s => (
                        <option key={s.code} value={s.code}>
                          [{s.code}] {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  {UNIT_AREAS.map(a => {
                    const isMkt = a.key === 'marketing' || a.key === 'mkt'
                    const hasAccess = isMkt
                      ? ((u.units ?? []).includes('marketing') || (u.units ?? []).includes('mkt'))
                      : (u.units ?? []).includes(a.key)
                    return (
                      <td key={a.key} className="px-2 text-center">
                        <input type="checkbox"
                          className="h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                          checked={u.user_type === 'admin' || hasAccess}
                          disabled={u.user_type === 'admin' && !isAdmin}
                          onChange={() => toggle(u, a.key)} title={UNIT_LABEL[a.key]} />
                      </td>
                    )
                  })}
                </tr>))}</tbody>
            </table>
          </div>}
      </div>
    </Card>
  )
}
