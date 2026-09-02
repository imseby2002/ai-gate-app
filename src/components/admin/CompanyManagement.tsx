'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Users, Plus, Search, Edit3, Trash2, UserPlus,
  Shield, Check, X, Loader2, Mail, ExternalLink, Settings,
  CheckCircle2, Clock, AlertTriangle, ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const ALL_MODULES = [
  { id: 'chat',      label: 'AI 對話' },
  { id: 'marketing', label: '行銷自動化' },
  { id: 'cs',        label: '客服系統' },
  { id: 'leads',     label: '潛在客戶' },
  { id: 'resume',    label: '職場助手' },
  { id: 'booking',   label: '訂房系統' },
  { id: 'work',      label: '工作管理' },
  { id: 'hr',        label: '人事管理' },
  { id: 'finance',   label: '出納總務' },
  { id: 'agent',     label: 'AI Agent' },
] as const

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  owner:   { label: '公司負責人',     color: 'bg-purple-100 text-purple-800 border-purple-200' },
  admin:   { label: '公司 IT / 管理員', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  manager: { label: '主管 / 經理',     color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  viewer:  { label: '一般成員',       color: 'bg-slate-100 text-slate-700 border-slate-200' },
}

export interface CompanyItem {
  id: string
  name: string
  created_by: string
  enabled_modules: string[] | null
  bnb_owner_id: string | null
  created_at: string
  creator: { id: string; email: string; full_name: string | null } | null
  owner: { id: string; email: string; full_name: string | null } | null
  it: { id: string; email: string; full_name: string | null } | null
  memberCount: number
  pendingCount: number
  members: Array<{
    id: string
    company_id: string
    member_id: string | null
    invited_email: string
    role: string
    status: string
    created_at: string
    profile: { id: string; email: string; full_name: string | null; user_type?: string } | null
  }>
}

export interface UserOption {
  id: string
  email: string
  full_name: string | null
  user_type: string
  company_id: string | null
}

interface Props {
  initialCompanies: CompanyItem[]
  allUsers: UserOption[]
}

export function CompanyManagement({ initialCompanies, allUsers }: Props) {
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyItem>(initialCompanies as any)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [managingCompany, setManagingCompany] = useState<CompanyItem | null>(null)
  const [editingCompany, setEditingCompany] = useState<CompanyItem | null>(null)

  // Form states for Create / Edit Company
  const [formName, setFormName] = useState('')
  const [formOwnerId, setFormOwnerId] = useState('')
  const [formItId, setFormItId] = useState('')
  const [formModules, setFormModules] = useState<string[]>([])

  // Member Management state
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('')
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState<'owner' | 'admin' | 'manager' | 'viewer'>('viewer')
  const [inviteEmail, setInviteEmail] = useState('')
  const [isAddingMember, setIsAddingMember] = useState(false)

  // Reload data
  const reloadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/companies')
      if (res.ok) {
        const d = await res.json()
        setCompanies(d.companies ?? [])
        if (managingCompany) {
          const updated = (d.companies ?? []).find((c: CompanyItem) => c.id === managingCompany.id)
          if (updated) setManagingCompany(updated)
        }
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
    router.refresh()
  }

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const showError = (msg: string) => {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(null), 4000)
  }

  // Filter companies
  const filteredCompanies = (Array.isArray(companies) ? companies : initialCompanies).filter(c => {
    const s = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(s) ||
      c.owner?.email.toLowerCase().includes(s) ||
      (c.owner?.full_name?.toLowerCase().includes(s)) ||
      c.it?.email.toLowerCase().includes(s) ||
      (c.it?.full_name?.toLowerCase().includes(s)) ||
      c.creator?.email.toLowerCase().includes(s)
    )
  })

  // Handle Create Company
  const handleOpenCreate = () => {
    setFormName('')
    setFormOwnerId('')
    setFormItId('')
    setFormModules(ALL_MODULES.map(m => m.id))
    setShowCreateModal(true)
  }

  const handleCreateCompany = async () => {
    if (!formName.trim()) {
      showError('請輸入公司名稱')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          ownerId: formOwnerId || undefined,
          itId: formItId || undefined,
          enabledModules: formModules,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '建立失敗')
      showSuccess(`成功建立公司「${formName.trim()}」`)
      setShowCreateModal(false)
      await reloadData()
    } catch (err: any) {
      showError(err.message)
    }
    setLoading(false)
  }

  // Handle Edit Company
  const handleOpenEdit = (company: CompanyItem) => {
    setEditingCompany(company)
    setFormName(company.name)
    setFormOwnerId(company.owner?.id ?? '')
    setFormItId(company.it?.id ?? '')
    setFormModules(company.enabled_modules ?? ALL_MODULES.map(m => m.id))
  }

  const handleSaveEdit = async () => {
    if (!editingCompany || !formName.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCompany.id,
          name: formName.trim(),
          ownerId: formOwnerId || undefined,
          itId: formItId,
          enabledModules: formModules,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '儲存失敗')
      showSuccess(`已更新公司「${formName.trim()}」設定`)
      setEditingCompany(null)
      await reloadData()
    } catch (err: any) {
      showError(err.message)
    }
    setLoading(false)
  }

  // Handle Delete Company
  const handleDeleteCompany = async (company: CompanyItem) => {
    if (!confirm(`確定要刪除公司「${company.name}」嗎？\n此操作將解除所有成員的歸屬關係，無法復原。`)) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: company.id }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '刪除失敗')
      showSuccess(`已成功刪除公司「${company.name}」`)
      if (managingCompany?.id === company.id) setManagingCompany(null)
      await reloadData()
    } catch (err: any) {
      showError(err.message)
    }
    setLoading(false)
  }

  // Member Operations
  const handleAddExistingUser = async () => {
    if (!managingCompany || !selectedUserToAdd) return
    setIsAddingMember(true)
    try {
      const res = await fetch(`/api/admin/companies/${managingCompany.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserToAdd,
          role: selectedRoleToAdd,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '加入成員失敗')
      showSuccess('成功將用戶納入公司！')
      setSelectedUserToAdd('')
      await reloadData()
    } catch (err: any) {
      showError(err.message)
    }
    setIsAddingMember(false)
  }

  const handleInviteEmail = async () => {
    if (!managingCompany || !inviteEmail.trim()) return
    setIsAddingMember(true)
    try {
      const res = await fetch(`/api/admin/companies/${managingCompany.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: selectedRoleToAdd,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '邀請失敗')
      showSuccess(`已送出對 ${inviteEmail.trim()} 的邀請`)
      setInviteEmail('')
      await reloadData()
    } catch (err: any) {
      showError(err.message)
    }
    setIsAddingMember(false)
  }

  const handleChangeMemberRole = async (memberRowId: string, newRole: string) => {
    if (!managingCompany) return
    try {
      const res = await fetch(`/api/admin/companies/${managingCompany.id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberRowId,
          role: newRole,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '修改角色失敗')
      showSuccess('已更新成員角色')
      await reloadData()
    } catch (err: any) {
      showError(err.message)
    }
  }

  const handleRemoveMember = async (memberRowId: string, memberId?: string | null, email?: string) => {
    if (!managingCompany) return
    if (!confirm(`確定要將成員「${email ?? '此成員'}」移出公司嗎？`)) return
    try {
      const res = await fetch(`/api/admin/companies/${managingCompany.id}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberRowId,
          memberId: memberId || undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '移除成員失敗')
      showSuccess('已將成員移出公司')
      await reloadData()
    } catch (err: any) {
      showError(err.message)
    }
  }

  // Calculate statistics
  const totalCompaniesCount = (Array.isArray(companies) ? companies : initialCompanies).length
  const totalMembersCount = (Array.isArray(companies) ? companies : initialCompanies).reduce(
    (acc, c) => acc + (c.memberCount ?? 0),
    0
  )

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {successMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-rose-600 text-white px-4 py-2.5 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-card border flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold">{totalCompaniesCount}</div>
            <div className="text-xs text-muted-foreground">已建立獨立公司數</div>
          </div>
        </Card>

        <Card className="p-5 bg-card border flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold">{totalMembersCount}</div>
            <div className="text-xs text-muted-foreground">公司旗下總成員數</div>
          </div>
        </Card>

        <Card className="p-5 bg-card border flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">快速建立公司</div>
            <div className="text-xs text-muted-foreground mt-0.5">獨立劃分團隊與開通權限</div>
          </div>
          <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" /> 建立新公司
          </Button>
        </Card>
      </div>

      {/* Main Companies Table */}
      <div className="bg-white dark:bg-card rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜尋公司名稱、負責人或信箱..."
              className="h-9 text-sm"
            />
          </div>
          <Button onClick={reloadData} variant="outline" size="sm" disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '重新載入'}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-muted-foreground text-left">
                <th className="px-5 py-3.5 font-medium">公司名稱</th>
                <th className="px-5 py-3.5 font-medium">公司負責人 (Owner)</th>
                <th className="px-5 py-3.5 font-medium">公司 IT (Admin)</th>
                <th className="px-5 py-3.5 font-medium text-center">成員數</th>
                <th className="px-5 py-3.5 font-medium">開通模組</th>
                <th className="px-5 py-3.5 font-medium">建立時間</th>
                <th className="px-5 py-3.5 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Building2 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                    尚無符合條件的公司。點擊上方「建立新公司」開始使用。
                  </td>
                </tr>
              ) : (
                filteredCompanies.map(comp => (
                  <tr key={comp.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
                        {comp.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">ID: {comp.id.slice(0, 8)}...</div>
                    </td>

                    <td className="px-5 py-4">
                      {comp.owner ? (
                        <div>
                          <div className="font-medium text-slate-800 dark:text-slate-200">{comp.owner.full_name || '未設姓名'}</div>
                          <div className="text-xs text-muted-foreground">{comp.owner.email}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          尚未指派負責人
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {comp.it ? (
                        <div>
                          <div className="font-medium text-slate-800 dark:text-slate-200">{comp.it.full_name || '未設姓名'}</div>
                          <div className="text-xs text-muted-foreground">{comp.it.email}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                          尚未指派 IT
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
                        <Users className="h-3.5 w-3.5 text-indigo-500" />
                        <span>{comp.memberCount} 人</span>
                        {comp.pendingCount > 0 && (
                          <span className="text-amber-600 text-[11px] font-normal">({comp.pendingCount} 待確認)</span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {comp.enabled_modules && comp.enabled_modules.length > 0 ? (
                          comp.enabled_modules.map((modId: string) => {
                            const found = ALL_MODULES.find(m => m.id === modId)
                            return (
                              <span key={modId} className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                                {found?.label ?? modId}
                              </span>
                            )
                          })
                        ) : (
                          <span className="text-[11px] text-muted-foreground">預設全模組開通</span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {new Date(comp.created_at).toLocaleDateString('zh-TW')}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          onClick={() => setManagingCompany(comp)}
                          size="sm"
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 border border-indigo-200 text-xs gap-1"
                        >
                          <Users className="h-3.5 w-3.5" /> 成員管理
                        </Button>
                        <Button
                          onClick={() => handleOpenEdit(comp)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                          title="公司設定"
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteCompany(comp)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          title="刪除公司"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: 建立獨立公司 ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-white dark:bg-card p-6 rounded-2xl shadow-2xl border space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-lg">建立獨立公司實體</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="font-semibold block mb-1">公司名稱 *</label>
                <Input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="例如：全球智慧科技股份有限公司"
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">指派公司負責人 (Owner)</label>
                <select
                  value={formOwnerId}
                  onChange={e => setFormOwnerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- 先不指定負責人（後續再指派） --</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                      {u.company_id ? ' [已有公司]' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">負責人將具備該公司的最高管理與成員邀請權限。</p>
              </div>

              <div>
                <label className="font-semibold block mb-1">指派公司 IT (Admin)</label>
                <select
                  value={formItId}
                  onChange={e => setFormItId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- 先不指定 IT（後續再指派） --</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                      {u.company_id ? ' [已有公司]' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">公司 IT 具備維護公司人員名單與單位授權之權限。</p>
              </div>

              <div>
                <label className="font-semibold block mb-2">開通模組權限</label>
                <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 border rounded-lg bg-slate-50 dark:bg-muted/20">
                  {ALL_MODULES.map(m => {
                    const checked = formModules.includes(m.id)
                    return (
                      <label key={m.id} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-white dark:hover:bg-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setFormModules(checked ? formModules.filter(id => id !== m.id) : [...formModules, m.id])
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{m.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button onClick={() => setShowCreateModal(false)} variant="outline">取消</Button>
              <Button onClick={handleCreateCompany} disabled={loading || !formName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '確認建立'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Modal: 公司設定 (編輯) ── */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-white dark:bg-card p-6 rounded-2xl shadow-2xl border space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-lg">公司設定 — {editingCompany.name}</h3>
              </div>
              <button onClick={() => setEditingCompany(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="font-semibold block mb-1">公司名稱 *</label>
                <Input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">變更公司負責人 (Owner)</label>
                <select
                  value={formOwnerId}
                  onChange={e => setFormOwnerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- 保留目前設定 --</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">變更公司 IT (Admin)</label>
                <select
                  value={formItId}
                  onChange={e => setFormItId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- 未指派 IT / 移除 IT --</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">公司 IT 具備維護公司人員名單與單位授權之權限。</p>
              </div>

              <div>
                <label className="font-semibold block mb-2">開通模組權限</label>
                <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 border rounded-lg bg-slate-50 dark:bg-muted/20">
                  {ALL_MODULES.map(m => {
                    const checked = formModules.includes(m.id)
                    return (
                      <label key={m.id} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-white dark:hover:bg-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setFormModules(checked ? formModules.filter(id => id !== m.id) : [...formModules, m.id])
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{m.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button onClick={() => setEditingCompany(null)} variant="outline">取消</Button>
              <Button onClick={handleSaveEdit} disabled={loading || !formName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '儲存變更'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Modal / Drawer: 公司成員管理 ── */}
      {managingCompany && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl bg-white dark:bg-card p-6 rounded-2xl shadow-2xl border space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-bold text-lg">{managingCompany.name} — 成員管理</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  目前擁有 {managingCompany.memberCount} 位成員（可隨時納入既有用戶或調整角色）
                </p>
              </div>
              <button onClick={() => setManagingCompany(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Section 1: 直接將現有使用者納入公司 */}
            <div className="p-4 rounded-xl border bg-slate-50/70 dark:bg-muted/20 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <UserPlus className="h-4 w-4 text-indigo-600" />
                將平台現有用戶直接納入此公司
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-6">
                  <select
                    value={selectedUserToAdd}
                    onChange={e => setSelectedUserToAdd(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border bg-white dark:bg-card text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- 選擇平台用戶 --</option>
                    {allUsers
                      .filter(u => !managingCompany.members.some(m => m.member_id === u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                          {u.company_id ? ' [已有其他公司]' : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <select
                    value={selectedRoleToAdd}
                    onChange={e => setSelectedRoleToAdd(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-lg border bg-white dark:bg-card text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="owner">公司負責人 (Owner)</option>
                    <option value="admin">公司 IT / 管理員 (Admin)</option>
                    <option value="manager">主管 / 經理 (Manager)</option>
                    <option value="viewer">一般成員 (Viewer)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <Button
                    onClick={handleAddExistingUser}
                    disabled={isAddingMember || !selectedUserToAdd}
                    size="sm"
                    className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                  >
                    {isAddingMember ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '納入'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Section 2: 邀請新信箱 */}
            <div className="p-4 rounded-xl border bg-slate-50/70 dark:bg-muted/20 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <Mail className="h-4 w-4 text-emerald-600" />
                透過 Email 邀請新成員
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-6">
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="sm:col-span-4">
                  <select
                    value={selectedRoleToAdd}
                    onChange={e => setSelectedRoleToAdd(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-lg border bg-white dark:bg-card text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="admin">公司 IT / 管理員 (Admin)</option>
                    <option value="manager">主管 / 經理 (Manager)</option>
                    <option value="viewer">一般成員 (Viewer)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <Button
                    onClick={handleInviteEmail}
                    disabled={isAddingMember || !inviteEmail.trim()}
                    size="sm"
                    className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  >
                    {isAddingMember ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '邀請'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Section 3: 公司成員清單 */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">目前名冊成員</h4>
              <div className="border rounded-xl overflow-hidden divide-y text-xs">
                {managingCompany.members.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">尚未有成員</div>
                ) : (
                  managingCompany.members.map(m => {
                    const roleInfo = ROLE_MAP[m.role] ?? { label: m.role, color: 'bg-slate-100 text-slate-700' }
                    return (
                      <div key={m.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/10">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase">
                            {m.profile?.full_name?.charAt(0) || m.invited_email.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <span>{m.profile?.full_name || '外部受邀者'}</span>
                              {m.status === 'active' ? (
                                <span className="inline-flex items-center text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                  <Check className="h-2.5 w-2.5 mr-0.5" /> 已加入
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                  <Clock className="h-2.5 w-2.5 mr-0.5" /> 待確認邀請
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">{m.invited_email}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={m.role}
                            onChange={e => handleChangeMemberRole(m.id, e.target.value)}
                            className={`h-7 px-2 text-[11px] font-medium rounded border ${roleInfo.color} outline-none cursor-pointer`}
                          >
                            <option value="owner">公司負責人</option>
                            <option value="admin">公司 IT / 管理員</option>
                            <option value="manager">主管 / 經理</option>
                            <option value="viewer">一般成員</option>
                          </select>

                          <Button
                            onClick={() => handleRemoveMember(m.id, m.member_id, m.invited_email)}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            title="移出公司"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button onClick={() => setManagingCompany(null)} variant="outline" size="sm">關閉</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
