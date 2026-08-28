'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Building2, Loader2, ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { UNIT_AREAS, COMMON_PAGES, UNIT_LABEL, hasUnit } from '@/lib/org-units'

interface Access { isAdmin: boolean; units: string[] }
interface UserRow { id: string; full_name: string | null; email: string | null; user_type: string; units: string[] | null }

export default function OfficePage() {
  const [access, setAccess] = useState<Access | null>(null)

  useEffect(() => { fetch('/api/org/access').then(r => r.ok ? r.json() : { isAdmin: false, units: [] }).then(setAccess) }, [])
  if (!access) return <div className="flex h-full items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>

  const visibleAreas = UNIT_AREAS
    .filter(a => hasUnit(access.isAdmin, access.units, a.key))
    .map(a => ({ ...a, pages: a.pages.filter(p => access.isAdmin || !p.adminOnly) }))
    .filter(a => a.pages.length > 0)

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">公司入口</h1>
          <p className="text-sm text-gray-500">依單位進入各自的系統{access.isAdmin ? '（管理者可見全部並指派單位）' : ''}</p>
        </div>
      </div>

      {/* 共用 */}
      <Card className="p-4">
        <div className="text-xs font-medium text-gray-500 mb-2">共用</div>
        <div className="flex flex-wrap gap-2">
          {COMMON_PAGES.map(p => <Link key={p.href} href={p.href}><Button variant="outline" size="sm" className="gap-1.5">{p.label}<ArrowRight className="h-3.5 w-3.5 opacity-50" /></Button></Link>)}
        </div>
      </Card>

      {/* 各單位 */}
      {visibleAreas.length === 0 ? (
        <Card className="p-6 text-center text-sm text-gray-400">尚未指派任何單位，請聯繫管理者。</Card>
      ) : visibleAreas.map(a => (
        <Card key={a.key} className="p-4">
          <div className="text-sm font-semibold mb-2">{a.label}</div>
          <div className="flex flex-wrap gap-2">
            {a.pages.map(p => <Link key={p.href} href={p.href}><Button variant="outline" size="sm" className="gap-1.5">{p.label}<ArrowRight className="h-3.5 w-3.5 opacity-50" /></Button></Link>)}
          </div>
        </Card>
      ))}

      {access.isAdmin && <AssignPanel />}
    </div>
  )
}

function AssignPanel() {
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
    <Card className="p-4 space-y-3">
      <div className="text-sm font-semibold flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" />單位權限指派</div>
      <p className="text-xs text-gray-400">勾選每位帳號可存取的單位；管理者一律全開。（各營運頁權限開放為「管理者或該單位」將於後續逐步啟用）</p>
      {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        : <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-3">帳號</th>{UNIT_AREAS.map(a => <th key={a.key} className="px-2 text-center font-medium">{a.label}</th>)}</tr></thead>
            <tbody>{users.map(u => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-1.5"><span>{u.full_name || u.email || u.id.slice(0, 8)}</span>{u.user_type === 'admin' && <span className="text-[11px] px-1 rounded bg-emerald-50 text-emerald-600">管理者</span>}{saving === u.id && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}</div>
                  {u.email && <div className="text-[11px] text-gray-400">{u.email}</div>}
                </td>
                {UNIT_AREAS.map(a => (
                  <td key={a.key} className="px-2 text-center">
                    <input type="checkbox" checked={u.user_type === 'admin' || (u.units ?? []).includes(a.key)} disabled={u.user_type === 'admin'} onChange={() => toggle(u, a.key)} title={UNIT_LABEL[a.key]} />
                  </td>
                ))}
              </tr>))}</tbody>
          </table>
        </div>}
    </Card>
  )
}
