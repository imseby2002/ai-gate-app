'use client'

import { useState, useEffect } from 'react'
import {
  Building2, Users, UserPlus, Mail, Shield, Trash2,
  CheckCircle2, Clock, Loader2, AlertCircle, Plus, Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const ROLE_INFO: Record<string, { label: string; color: string }> = {
  owner:   { label: '公司擁有者', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  admin:   { label: '公司管理員', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  manager: { label: '部門主管',   color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  viewer:  { label: '一般成員',   color: 'bg-slate-100 text-slate-700 border-slate-200' },
}

interface MemberItem {
  id: string
  email: string
  role: string
  status: string
  createdAt: string
  member: { email: string | null; full_name: string | null } | null
}

interface CompanyData {
  companyId: string
  name: string
  role: string
}

export function CompanyMembershipSection() {
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [members, setMembers] = useState<MemberItem[]>([])
  const [newCompanyName, setNewCompanyName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'viewer'>('viewer')
  const [isInviting, setIsInviting] = useState(false)

  // Toast msg
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/company/members')
      if (res.ok) {
        const d = await res.json()
        setCompany(d.company ?? null)
        setMembers(d.members ?? [])
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  // 建立新公司
  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      showMsg('請輸入公司名稱', 'error')
      return
    }
    setIsCreating(true)
    try {
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCompanyName.trim() }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '建立失敗')
      showMsg(`成功建立「${newCompanyName.trim()}」！您已成為公司擁有者。`)
      setNewCompanyName('')
      await loadData()
    } catch (err: any) {
      showMsg(err.message, 'error')
    }
    setIsCreating(false)
  }

  // 邀請新成員
  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      showMsg('請輸入要邀請的 Email', 'error')
      return
    }
    setIsInviting(true)
    try {
      const res = await fetch('/api/company/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '邀請失敗')
      showMsg(`已發送邀請予 ${inviteEmail.trim()}`)
      setInviteEmail('')
      await loadData()
    } catch (err: any) {
      showMsg(err.message, 'error')
    }
    setIsInviting(false)
  }

  // 變更成員角色
  const handleChangeRole = async (id: string, role: string) => {
    try {
      const res = await fetch('/api/company/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, role }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '更新角色失敗')
      showMsg('已成功更新成員角色')
      await loadData()
    } catch (err: any) {
      showMsg(err.message, 'error')
    }
  }

  // 移除成員
  const handleRemoveMember = async (id: string, email: string) => {
    if (!confirm(`確定要將「${email}」移出公司嗎？`)) return
    try {
      const res = await fetch('/api/company/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '移除成員失敗')
      showMsg('已成功移除成員')
      await loadData()
    } catch (err: any) {
      showMsg(err.message, 'error')
    }
  }

  if (loading) {
    return (
      <Card className="p-6 border bg-card flex items-center justify-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
        載入公司成員資訊中...
      </Card>
    )
  }

  const isOwnerOrAdmin = company?.role === 'owner' || company?.role === 'admin'

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {msg && (
        <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-medium ${
          msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />}
          <span>{msg.text}</span>
        </div>
      )}

      {!company ? (
        /* 尚未屬於任何公司：顯示建立公司面板 */
        <Card className="p-6 border bg-card rounded-2xl space-y-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">建立獨立公司空間</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                您尚未加入任何公司。您可以建立自己的獨立公司實體，成為公司擁有者 (Owner)，並邀請團隊成員共享品牌素材、行銷知識庫與協同作業。
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <Input
              value={newCompanyName}
              onChange={e => setNewCompanyName(e.target.value)}
              placeholder="輸入您的公司或團隊名稱 (例如: 宏達科技)"
              className="text-sm h-10 flex-1"
            />
            <Button
              onClick={handleCreateCompany}
              disabled={isCreating || !newCompanyName.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 gap-1.5 shrink-0"
            >
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              建立公司
            </Button>
          </div>
        </Card>
      ) : (
        /* 已有公司：顯示公司資訊與成員名單 */
        <Card className="p-6 border bg-card rounded-2xl space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{company.name}</h3>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${ROLE_INFO[company.role]?.color}`}>
                    {ROLE_INFO[company.role]?.label ?? company.role}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  共 {members.length} 位成員（含進行中邀請）
                </p>
              </div>
            </div>
          </div>

          {/* 邀請新成員（僅 Owner / Admin 可見） */}
          {isOwnerOrAdmin && (
            <div className="p-4 rounded-xl border bg-slate-50/70 dark:bg-muted/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                <UserPlus className="h-3.5 w-3.5 text-indigo-600" />
                邀請新同仁加入此公司
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-6">
                  <Input
                    type="email"
                    placeholder="輸入同仁 Email (例如 colleague@company.com)"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="sm:col-span-4">
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-lg border bg-white dark:bg-card text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="admin">管理員 (Admin)</option>
                    <option value="manager">部門主管 (Manager)</option>
                    <option value="viewer">一般成員 (Viewer)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <Button
                    onClick={handleInviteMember}
                    disabled={isInviting || !inviteEmail.trim()}
                    size="sm"
                    className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                  >
                    {isInviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '送出邀請'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 成員列表 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-slate-500" /> 成員名冊
            </h4>

            <div className="border rounded-xl overflow-hidden divide-y text-xs bg-white dark:bg-card">
              {members.map(m => {
                const roleObj = ROLE_INFO[m.role] ?? { label: m.role, color: 'bg-slate-100 text-slate-700' }
                const isMemberOwner = m.role === 'owner'

                return (
                  <div key={m.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/10">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase">
                        {m.member?.full_name?.charAt(0) || m.email.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span>{m.member?.full_name || '外部受邀者'}</span>
                          {m.status === 'active' ? (
                            <span className="inline-flex items-center text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> 已加入
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              <Clock className="h-2.5 w-2.5 mr-0.5" /> 待確認
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">{m.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isOwnerOrAdmin && !isMemberOwner ? (
                        <select
                          value={m.role}
                          onChange={e => handleChangeRole(m.id, e.target.value)}
                          className={`h-7 px-2 text-[11px] font-medium rounded border ${roleObj.color} outline-none cursor-pointer`}
                        >
                          <option value="admin">管理員</option>
                          <option value="manager">部門主管</option>
                          <option value="viewer">一般成員</option>
                        </select>
                      ) : (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${roleObj.color}`}>
                          {roleObj.label}
                        </span>
                      )}

                      {isOwnerOrAdmin && !isMemberOwner && (
                        <Button
                          onClick={() => handleRemoveMember(m.id, m.email)}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          title="移出公司"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
