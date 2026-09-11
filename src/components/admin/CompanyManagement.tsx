'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Users, Plus, Search, Trash2, UserPlus,
  Shield, Check, X, Loader2, Mail, Settings,
  CheckCircle2, Clock, AlertTriangle, Sparkles,
  ExternalLink, ChevronRight, UserCheck, Crown, RefreshCw, Copy
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const ALL_MODULES = [
  { id: 'chat',      label: 'AI 對話',     desc: '多模型智能對話與知識庫' },
  { id: 'marketing', label: '行銷自動化',   desc: '社群內容自動生成與發布' },
  { id: 'cs',        label: '客服系統',     desc: '全通路 AI 智能客服與分流' },
  { id: 'leads',     label: '潛在客戶',     desc: '自動化名單追蹤與商機管理' },
  { id: 'resume',    label: '職場助手',     desc: '履歷優化與面試輔導' },
  { id: 'booking',   label: '訂房系統',     desc: '旅宿房況與訂單即時排程' },
  { id: 'work',      label: '工作管理',     desc: '跨部門任務看板與進度追蹤' },
  { id: 'hr',        label: '人事管理',     desc: '員工名冊、打卡與休假管理' },
  { id: 'finance',   label: '出納總務',     desc: '財務記帳、收支明細與報銷' },
  { id: 'agent',     label: 'AI Agent',    desc: '自主多智慧體執行與排程' },
] as const

const ROLE_CONFIG: Record<string, { label: string; badgeClass: string; icon: typeof Crown }> = {
  owner:   { label: '負責人 (Owner)',  badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80', icon: Crown },
  admin:   { label: 'IT 管理員 (Admin)', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',     icon: Shield },
  manager: { label: '主管 / 經理',      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', icon: UserCheck },
  viewer:  { label: '一般成員',        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',      icon: Users },
}

export interface CompanyItem {
  id: string
  name: string
  created_by: string
  enabled_modules: string[] | null
  bnb_owner_id: string | null
  feedback_free_features: boolean
  free_feature_quota_monthly: number | null
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

// Generate consistent gradient for company avatars
const AVATAR_GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-fuchsia-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
]

function getAvatarGradient(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

function getRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days <= 0) return '今天建立'
  if (days === 1) return '昨天'
  if (days < 30) return `${days} 天前`
  const months = Math.floor(days / 30)
  return `${months} 個月前`
}

export function CompanyManagement({ initialCompanies, allUsers }: Props) {
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyItem[]>(initialCompanies)
  const [search, setSearch] = useState('')
  const [filterOwner, setFilterOwner] = useState<'all' | 'has_owner' | 'no_owner'>('all')
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
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
  const [formFeedbackFree, setFormFeedbackFree] = useState(false)
  const [formFeedbackQuota, setFormFeedbackQuota] = useState('')

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

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Filter companies
  const filteredCompanies = useMemo(() => {
    return (Array.isArray(companies) ? companies : initialCompanies).filter(c => {
      const s = search.toLowerCase()
      const matchSearch =
        c.name.toLowerCase().includes(s) ||
        c.id.toLowerCase().includes(s) ||
        (c.owner?.email?.toLowerCase().includes(s)) ||
        (c.owner?.full_name?.toLowerCase().includes(s)) ||
        (c.it?.email?.toLowerCase().includes(s)) ||
        (c.it?.full_name?.toLowerCase().includes(s)) ||
        (c.creator?.email?.toLowerCase().includes(s))

      if (!matchSearch) return false

      if (filterOwner === 'has_owner') return !!c.owner
      if (filterOwner === 'no_owner') return !c.owner
      return true
    })
  }, [companies, initialCompanies, search, filterOwner])

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
    setFormFeedbackFree(company.feedback_free_features ?? false)
    setFormFeedbackQuota(company.free_feature_quota_monthly != null ? String(company.free_feature_quota_monthly) : '')
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
          itId: formItId || '',
          enabledModules: formModules,
          feedbackFree: formFeedbackFree,
          freeFeatureQuotaMonthly: formFeedbackQuota.trim() === '' ? null : Number(formFeedbackQuota),
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
  const totalPendingCount = (Array.isArray(companies) ? companies : initialCompanies).reduce(
    (acc, c) => acc + (c.pendingCount ?? 0),
    0
  )

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {successMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2 border border-emerald-500">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 bg-rose-600 text-white px-4 py-3 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2 border border-rose-500">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* ── Top Statistics Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: 企業實體 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-sm shrink-0">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{totalCompaniesCount} <span className="text-sm font-normal text-slate-500">間</span></div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">已註冊獨立企業實體</div>
          </div>
        </div>

        {/* Card 2: 組織成員數 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {totalMembersCount} <span className="text-sm font-normal text-slate-500">位</span>
              {totalPendingCount > 0 && (
                <span className="text-xs font-semibold text-amber-600 ml-2">({totalPendingCount} 位待確認)</span>
              )}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">全公司旗下活躍成員總數</div>
          </div>
        </div>

        {/* Card 3: 快速建立新公司 */}
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 text-white rounded-2xl p-5 border border-indigo-800/40 shadow-sm flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" />
              快速建立新公司實體
            </div>
            <div className="text-xs text-indigo-200/80 mt-1">獨立開闢工作空間與模組授權</div>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-xs px-3.5 py-2 h-9 rounded-xl gap-1.5 shadow-md shrink-0 transition-transform active:scale-95"
          >
            <Plus className="h-4 w-4" /> 建立新公司
          </Button>
        </div>
      </div>

      {/* ── Main Companies Table Container ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/40">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜尋公司名稱、負責人、IT 或信箱..."
                className="pl-9 h-9 text-sm bg-white border-slate-200 rounded-xl focus-visible:ring-indigo-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600">
              <button
                onClick={() => setFilterOwner('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${filterOwner === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'}`}
              >
                全部 ({totalCompaniesCount})
              </button>
              <button
                onClick={() => setFilterOwner('has_owner')}
                className={`px-2.5 py-1 rounded-lg transition-all ${filterOwner === 'has_owner' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'}`}
              >
                已指派負責人
              </button>
              <button
                onClick={() => setFilterOwner('no_owner')}
                className={`px-2.5 py-1 rounded-lg transition-all ${filterOwner === 'no_owner' ? 'bg-white text-amber-700 shadow-2xs font-semibold' : 'hover:text-slate-900'}`}
              >
                待指派
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={reloadData}
              variant="outline"
              size="sm"
              disabled={loading}
              className="h-9 px-3 text-xs font-medium gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              重新整理
            </Button>
          </div>
        </div>

        {/* The Clean Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                <th className="px-6 py-3.5 whitespace-nowrap min-w-[220px]">公司名稱</th>
                <th className="px-6 py-3.5 whitespace-nowrap min-w-[210px]">公司負責人 (Owner)</th>
                <th className="px-6 py-3.5 whitespace-nowrap min-w-[190px]">公司 IT (Admin)</th>
                <th className="px-5 py-3.5 whitespace-nowrap min-w-[110px] text-center">成員數</th>
                <th className="px-6 py-3.5 whitespace-nowrap min-w-[260px] max-w-[340px]">開通模組</th>
                <th className="px-5 py-3.5 whitespace-nowrap min-w-[110px]">建立時間</th>
                <th className="px-6 py-3.5 whitespace-nowrap min-w-[150px] text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-medium text-slate-600">尚無符合條件的公司實體</p>
                    <p className="text-xs text-slate-400 mt-1">點擊右上角「建立新公司」即可新增企業工作空間</p>
                  </td>
                </tr>
              ) : (
                filteredCompanies.map(comp => {
                  const gradient = getAvatarGradient(comp.name)
                  const initialChar = comp.name.trim().charAt(0).toUpperCase() || '🏢'
                  const isAllModules = !comp.enabled_modules || comp.enabled_modules.length >= ALL_MODULES.length

                  return (
                    <tr key={comp.id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* 1. 公司名稱 */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-lg shadow-xs shrink-0 select-none`}>
                            {initialChar}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-base leading-snug tracking-tight">
                              {comp.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span
                                onClick={(e) => handleCopyId(comp.id, e)}
                                title="點擊複製完整 UUID"
                                className="font-mono text-[11px] text-slate-500 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1"
                              >
                                {comp.id.slice(0, 8)}...
                                <Copy className="h-2.5 w-2.5 text-slate-400" />
                              </span>
                              {copiedId === comp.id && (
                                <span className="text-[10px] text-emerald-600 font-semibold animate-in fade-in">已複製</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. 公司負責人 (Owner) */}
                      <td className="px-6 py-4">
                        {comp.owner ? (
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0 ring-2 ring-purple-50">
                              {(comp.owner.full_name || comp.owner.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-900 text-sm truncate">{comp.owner.full_name || '未設姓名'}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80 font-semibold shrink-0">負責人</span>
                              </div>
                              <div className="text-xs text-slate-500 truncate font-mono mt-0.5">{comp.owner.email}</div>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenEdit(comp)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200/80 transition-colors"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            <span>尚未指派負責人</span>
                          </button>
                        )}
                      </td>

                      {/* 3. 公司 IT (Admin) */}
                      <td className="px-6 py-4">
                        {comp.it ? (
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 ring-2 ring-blue-50">
                              {(comp.it.full_name || comp.it.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-900 text-sm truncate">{comp.it.full_name || '未設姓名'}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold shrink-0">IT</span>
                              </div>
                              <div className="text-xs text-slate-500 truncate font-mono mt-0.5">{comp.it.email}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                            <Shield className="h-3 w-3 text-slate-300" />
                            <span>尚未指派 IT</span>
                          </span>
                        )}
                      </td>

                      {/* 4. 成員數 */}
                      <td className="px-5 py-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200/70 shadow-2xs">
                            <Users className="h-3.5 w-3.5 text-indigo-600" />
                            <span>{comp.memberCount} 人</span>
                          </span>
                          {comp.pendingCount > 0 && (
                            <span className="text-[10px] text-amber-600 font-medium mt-1">({comp.pendingCount} 待確認)</span>
                          )}
                        </div>
                      </td>

                      {/* 5. 開通模組 (水平流暢排版，杜絕垂直大積木) */}
                      <td className="px-6 py-4">
                        {isAllModules ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/90 text-xs font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              <span>全模組開通 ({ALL_MODULES.length} 項功能)</span>
                            </span>
                            <button
                              onClick={() => handleOpenEdit(comp)}
                              className="text-[11px] text-slate-400 hover:text-indigo-600 font-medium hover:underline cursor-pointer"
                            >
                              管理
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 items-center max-w-[320px]">
                            {(comp.enabled_modules ?? []).slice(0, 3).map(modId => {
                              const found = ALL_MODULES.find(m => m.id === modId)
                              return (
                                <span
                                  key={modId}
                                  className="whitespace-nowrap text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/70 px-2 py-0.5 rounded-md"
                                >
                                  {found?.label ?? modId}
                                </span>
                              )
                            })}
                            {(comp.enabled_modules?.length ?? 0) > 3 && (
                              <button
                                onClick={() => handleOpenEdit(comp)}
                                className="whitespace-nowrap text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded-md transition-colors"
                              >
                                +{(comp.enabled_modules?.length ?? 0) - 3} 項
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 6. 建立時間 */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col text-xs text-slate-600">
                          <span className="font-semibold text-slate-800 font-mono">
                            {new Date(comp.created_at).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                          </span>
                          <span className="text-[11px] text-slate-400 mt-0.5">
                            {getRelativeTime(comp.created_at)}
                          </span>
                        </div>
                      </td>

                      {/* 7. 操作按鈕 */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            onClick={() => setManagingCompany(comp)}
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3 py-1.5 h-8 rounded-lg shadow-2xs gap-1.5 transition-all"
                          >
                            <Users className="h-3.5 w-3.5" />
                            <span>成員管理</span>
                          </Button>
                          <Button
                            onClick={() => handleOpenEdit(comp)}
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded-lg"
                            title="公司設定與模組權限"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteCompany(comp)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="刪除公司"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: 建立獨立公司 ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-xl bg-white p-6 sm:p-7 rounded-2xl shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">建立獨立企業公司實體</h3>
                  <p className="text-xs text-slate-500 mt-0.5">獨立劃分團隊成員、負責人與 AI 模組授權</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="font-bold text-slate-800 block mb-1.5">
                  公司名稱 <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="例如：全球智慧科技股份有限公司、喬民宿"
                  className="w-full h-10 text-sm bg-white border-slate-200 rounded-xl focus-visible:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1.5">指派公司負責人 (Owner)</label>
                <select
                  value={formOwnerId}
                  onChange={e => setFormOwnerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- 先不指定負責人（後續再指派） --</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                      {u.company_id ? ' [已有公司]' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">負責人具備該公司的最高管理與成員邀請權限。</p>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1.5">指派公司 IT (Admin)</label>
                <select
                  value={formItId}
                  onChange={e => setFormItId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- 先不指定 IT（後續再指派） --</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                      {u.company_id ? ' [已有公司]' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">公司 IT 具備維護公司人員名冊與功能授權權限。</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-800 block">開通模組權限 ({formModules.length}/{ALL_MODULES.length})</label>
                  <div className="text-xs font-semibold text-indigo-600 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormModules(ALL_MODULES.map(m => m.id))}
                      className="hover:underline"
                    >
                      全選
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setFormModules([])}
                      className="hover:underline text-slate-400"
                    >
                      清空
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 border border-slate-200 rounded-xl bg-slate-50/50">
                  {ALL_MODULES.map(m => {
                    const checked = formModules.includes(m.id)
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-2 text-xs p-2 rounded-lg border transition-all cursor-pointer select-none ${checked ? 'bg-white border-indigo-200 shadow-2xs font-semibold text-slate-900' : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-100'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setFormModules(checked ? formModules.filter(id => id !== m.id) : [...formModules, m.id])
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                        />
                        <span>{m.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <Button onClick={() => setShowCreateModal(false)} variant="outline" className="rounded-xl border-slate-200">
                取消
              </Button>
              <Button
                onClick={handleCreateCompany}
                disabled={loading || !formName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '確認建立'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Modal: 公司設定 (編輯) ── */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-xl bg-white p-6 sm:p-7 rounded-2xl shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">公司設定 — {editingCompany.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">變更公司名稱、指派負責人與調整開通權限</p>
                </div>
              </div>
              <button
                onClick={() => setEditingCompany(null)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="font-bold text-slate-800 block mb-1.5">公司名稱 *</label>
                <Input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full h-10 text-sm bg-white border-slate-200 rounded-xl focus-visible:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1.5">變更公司負責人 (Owner)</label>
                <select
                  value={formOwnerId}
                  onChange={e => setFormOwnerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- 先不指定負責人 --</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1.5">變更公司 IT (Admin)</label>
                <select
                  value={formItId}
                  onChange={e => setFormItId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- 未指派 IT / 移除 IT --</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-800 block">開通模組權限 ({formModules.length}/{ALL_MODULES.length})</label>
                  <div className="text-xs font-semibold text-indigo-600 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormModules(ALL_MODULES.map(m => m.id))}
                      className="hover:underline"
                    >
                      全選
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setFormModules([])}
                      className="hover:underline text-slate-400"
                    >
                      清空
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 border border-slate-200 rounded-xl bg-slate-50/50">
                  {ALL_MODULES.map(m => {
                    const checked = formModules.includes(m.id)
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-2 text-xs p-2 rounded-lg border transition-all cursor-pointer select-none ${checked ? 'bg-white border-indigo-200 shadow-2xs font-semibold text-slate-900' : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-100'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setFormModules(checked ? formModules.filter(id => id !== m.id) : [...formModules, m.id])
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                        />
                        <span>{m.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formFeedbackFree}
                    onChange={e => setFormFeedbackFree(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <div>
                    <div className="text-sm font-bold text-slate-800">意見反映：功能新增/調整完全免計費（不限次數）</div>
                    <div className="text-xs text-slate-500 mt-0.5">開啟後，這間公司送出的「功能新增/調整」需求一律直接視同免費走 AI 自動處理</div>
                  </div>
                </label>

                {!formFeedbackFree && (
                  <div className="flex items-center gap-2 pl-6">
                    <label className="text-xs font-medium text-slate-700 shrink-0">每月免費次數上限</label>
                    <Input
                      type="number"
                      min={0}
                      value={formFeedbackQuota}
                      onChange={e => setFormFeedbackQuota(e.target.value)}
                      placeholder="留空＝不免費，超過此次數才需要老闆審核計費"
                      className="h-8 text-xs bg-white border-slate-200 rounded-lg"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <Button onClick={() => setEditingCompany(null)} variant="outline" className="rounded-xl border-slate-200">
                取消
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={loading || !formName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '儲存變更'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Modal / Drawer: 公司成員管理 ── */}
      {managingCompany && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-2xl bg-white p-6 sm:p-7 rounded-2xl shadow-2xl border border-slate-200 space-y-6 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${getAvatarGradient(managingCompany.name)} flex items-center justify-center text-white font-black text-lg shadow-xs shrink-0`}>
                  {managingCompany.name.trim().charAt(0).toUpperCase() || '🏢'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{managingCompany.name} — 成員名單</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    共 {managingCompany.memberCount} 位成員（可隨時納入既有用戶、邀請新信箱或調整角色）
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingCompany(null)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Section 1: 直接將現有使用者納入公司 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <UserPlus className="h-4 w-4 text-indigo-600" />
                將平台現有用戶直接納入此公司
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-6">
                  <select
                    value={selectedUserToAdd}
                    onChange={e => setSelectedUserToAdd(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg"
                  >
                    {isAddingMember ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '納入'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Section 2: 邀請新信箱 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Mail className="h-4 w-4 text-emerald-600" />
                透過 Email 邀請新成員加入
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-6">
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="h-9 text-xs bg-white border-slate-200 rounded-lg"
                  />
                </div>

                <div className="sm:col-span-4">
                  <select
                    value={selectedRoleToAdd}
                    onChange={e => setSelectedRoleToAdd(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg"
                  >
                    {isAddingMember ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '邀請'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Section 3: 公司成員清單 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900">目前名冊成員 ({managingCompany.members.length})</h4>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs bg-white">
                {managingCompany.members.length === 0 ? (
                  <div className="py-10 text-center text-slate-400">尚未有成員加入此公司</div>
                ) : (
                  managingCompany.members.map(m => {
                    const roleInfo = ROLE_CONFIG[m.role] ?? { label: m.role, badgeClass: 'bg-slate-100 text-slate-700' }
                    return (
                      <div key={m.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 ring-2 ring-indigo-50 uppercase">
                            {m.profile?.full_name?.charAt(0) || m.invited_email.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              <span className="truncate">{m.profile?.full_name || '受邀成員'}</span>
                              {m.status === 'active' ? (
                                <span className="inline-flex items-center text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-semibold shrink-0">
                                  <Check className="h-2.5 w-2.5 mr-0.5" /> 已啟用
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 font-semibold shrink-0">
                                  <Clock className="h-2.5 w-2.5 mr-0.5" /> 待確認
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-mono truncate mt-0.5">{m.invited_email}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={m.role}
                            onChange={e => handleChangeMemberRole(m.id, e.target.value)}
                            className={`h-8 px-2.5 text-xs font-semibold rounded-lg border ${roleInfo.badgeClass} outline-none cursor-pointer`}
                          >
                            <option value="owner">公司負責人 (Owner)</option>
                            <option value="admin">公司 IT / 管理員 (Admin)</option>
                            <option value="manager">主管 / 經理 (Manager)</option>
                            <option value="viewer">一般成員 (Viewer)</option>
                          </select>

                          <Button
                            onClick={() => handleRemoveMember(m.id, m.member_id, m.invited_email)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button onClick={() => setManagingCompany(null)} variant="outline" className="rounded-xl border-slate-200 text-slate-700">
                完成關閉
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
