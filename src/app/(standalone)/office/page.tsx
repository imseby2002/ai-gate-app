'use client'

import { useState, useEffect, type ComponentType } from 'react'
import Link from 'next/link'
import {
  Building2, Loader2, ChevronRight, ShieldCheck, ArrowUpRight,
  Users, Wallet, FlaskConical, Store, Briefcase, Wrench, Crown, LayoutGrid,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UNIT_AREAS, COMMON_PAGES, UNIT_LABEL, hasUnit } from '@/lib/org-units'

interface Access {
  isAdmin: boolean
  isCompanyAdmin?: boolean
  canManage?: boolean
  companyRole?: string | null
  companyName?: string | null
  units: string[]
}
interface UserRow { id: string; full_name: string | null; email: string | null; user_type: string; units: string[] | null }

// 各單位的圖示與主題色（class 為完整字串，讓 Tailwind 能靜態掃描）
const UNIT_STYLE: Record<string, { icon: ComponentType<{ className?: string }>; chip: string; ring: string }> = {
  hr:      { icon: Users,        chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',       ring: 'hover:border-blue-400/60' },
  finance: { icon: Wallet,       chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', ring: 'hover:border-emerald-400/60' },
  rd:      { icon: FlaskConical, chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',   ring: 'hover:border-violet-400/60' },
  store:   { icon: Store,        chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',     ring: 'hover:border-amber-400/60' },
  affairs: { icon: Briefcase,    chip: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',        ring: 'hover:border-cyan-400/60' },
  audit:   { icon: ShieldCheck,  chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',        ring: 'hover:border-rose-400/60' },
  repair:  { icon: Wrench,       chip: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',  ring: 'hover:border-orange-400/60' },
  gm:      { icon: Crown,        chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',  ring: 'hover:border-indigo-400/60' },
}
const fallbackStyle = { icon: LayoutGrid, chip: 'bg-primary/10 text-primary', ring: 'hover:border-primary/50' }

export default function OfficePage() {
  const [access, setAccess] = useState<Access | null>(null)

  useEffect(() => {
    fetch('/api/org/access')
      .then(r => r.ok ? r.json() : { isAdmin: false, canManage: false, units: [] })
      .then(setAccess)
  }, [])

  if (!access) return <div className="flex h-full items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const canManage = access.canManage ?? access.isAdmin
  const roleLabel = access.isAdmin ? '平台管理者' : access.companyRole === 'owner' ? '公司負責人' : access.isCompanyAdmin ? '公司 IT' : null
  const visibleAreas = UNIT_AREAS
    .filter(a => hasUnit(canManage, access.units, a.key))
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
              依單位進入各自的系統{canManage ? '，管理者可見全部單位並指派人員權限。' : '。'}
            </p>
            {COMMON_PAGES.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium mr-1">全公司共用：</span>
                {COMMON_PAGES.map(p => (
                  <Link key={p.href} href={p.href}>
                    <Button
                      variant={p.href === '/units' ? 'default' : 'outline'}
                      size="sm"
                      className={`gap-1.5 rounded-full ${p.href === '/units' ? 'shadow-sm font-medium' : 'bg-card/60 backdrop-blur'}`}
                    >
                      {p.href === '/units' && <Building2 className="h-3.5 w-3.5" />}
                      {p.label}
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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
            return (
              <Card key={a.key} className={`p-0 overflow-hidden transition-colors border ${st.ring}`}>
                <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${st.chip}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="font-semibold">{a.label}</div>
                  <span className="ml-auto text-xs text-muted-foreground">{a.pages.length}</span>
                </div>
                <div className="px-2 pb-2">
                  {a.pages.map(p => (
                    <Link key={p.href} href={p.href}
                      className="group flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted transition-colors">
                      <span className="flex-1 truncate">{p.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {canManage && (
        <AssignPanel
          isAdmin={access.isAdmin}
          isCompanyAdmin={access.isCompanyAdmin}
          companyRole={access.companyRole}
        />
      )}
    </div>
  )
}

function AssignPanel({ isAdmin, isCompanyAdmin, companyRole }: { isAdmin: boolean; isCompanyAdmin?: boolean; companyRole?: string | null }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.ok ? r.json() : { users: [] }).then(d => {
      setUsers((d.users ?? []).map((u: UserRow) => ({ ...u, units: u.units ?? [] })))
      setLoading(false)
    })
  }, [])

  const toggle = async (u: UserRow, key: string) => {
    const cur = u.units ?? []
    const next = cur.includes(key) ? cur.filter(x => x !== key) : [...cur, key]
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, units: next } : x))
    setSaving(u.id)
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: u.id, units: next }) })
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
          由公司負責人或 IT 維護人員名單與單位授權；勾選每位帳號可存取的單位。
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
                  {UNIT_AREAS.map(a => (
                    <td key={a.key} className="px-2 text-center">
                      <input type="checkbox"
                        className="h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                        checked={u.user_type === 'admin' || (u.units ?? []).includes(a.key)}
                        disabled={u.user_type === 'admin' && !isAdmin}
                        onChange={() => toggle(u, a.key)} title={UNIT_LABEL[a.key]} />
                    </td>
                  ))}
                </tr>))}</tbody>
            </table>
          </div>}
      </div>
    </Card>
  )
}
