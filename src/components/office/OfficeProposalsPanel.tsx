'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Lightbulb, AlertCircle, Plus, CheckCircle2, Clock, Check, X,
  Loader2, Filter, Sparkles, MessageSquare, ChevronDown, ChevronUp,
  Image as ImageIcon, Upload, Copy, ArrowRight, ShieldCheck, Tag,
  ExternalLink, User, Store, Building2, RefreshCw, Layers
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface Proposal {
  id: string
  user_id: string
  type: 'problem' | 'idea'
  title: string
  department: string
  department_label?: string
  store_code?: string
  description: string
  expected_solution: string
  attachments: string[]
  author_name: string
  author_email: string
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'rejected'
  admin_notes: string
  ai_plan: string
  branch_name?: string
  pr_url?: string
  created_at: string
  updated_at: string
  approved_at?: string
  approved_by_name?: string
}

const DEPARTMENTS: { key: string; label: string; icon: string }[] = [
  { key: 'store',     label: '門市營運', icon: '🏪' },
  { key: 'finance',   label: '出納總務', icon: '💰' },
  { key: 'rd',        label: '研發配方', icon: '🧪' },
  { key: 'hr',        label: '人事管理', icon: '👥' },
  { key: 'audit',     label: '稽核巡檢', icon: '🛡️' },
  { key: 'repair',    label: '設備維修', icon: '🔧' },
  { key: 'affairs',   label: '外務證照', icon: '📑' },
  { key: 'marketing', label: '品牌行銷', icon: '📣' },
  { key: 'gm',        label: '總經理室', icon: '👑' },
  { key: 'system',    label: '全系統共用', icon: '🌐' },
]

export function OfficeProposalsPanel({ canManage = false }: { canManage?: boolean }) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUserStore, setCurrentUserStore] = useState('')

  // 篩選與搜尋
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'in_progress' | 'completed' | 'mine'>('all')
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'problem' | 'idea'>('all')
  const [search, setSearch] = useState('')

  // 提案彈窗狀態
  const [showModal, setShowModal] = useState(false)
  const [formType, setFormType] = useState<'problem' | 'idea'>('idea')
  const [formDept, setFormDept] = useState('store')
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formSolution, setFormSolution] = useState('')
  const [formAttachments, setFormAttachments] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 審核操作
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({})
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/office/proposals')
      if (res.ok) {
        const d = await res.json()
        setProposals(d.proposals ?? [])
        if (d.currentUser) {
          setCurrentUserId(d.currentUser.id || '')
          setCurrentUserStore(d.currentUser.store_code || '')
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 上傳截圖附件
  const handleUpload = async (file: File) => {
    setUploadingImg(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/office/proposals/upload', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (res.ok && data.url) {
        setFormAttachments(prev => [...prev, data.url])
      } else {
        alert(data.error || '圖片上傳失敗')
      }
    } catch {
      alert('上傳失敗，請確認網路連線')
    } finally {
      setUploadingImg(false)
    }
  }

  // 提交新提案
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim() || !formDesc.trim()) {
      alert('請填寫提案標題與問題/想法描述')
      return
    }

    setSubmitting(true)
    try {
      const deptObj = DEPARTMENTS.find(d => d.key === formDept)
      const res = await fetch('/api/office/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formType,
          department: formDept,
          department_label: deptObj?.label || formDept,
          title: formTitle,
          description: formDesc,
          expected_solution: formSolution,
          attachments: formAttachments,
          store_code: currentUserStore,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setShowModal(false)
        setFormTitle('')
        setFormDesc('')
        setFormSolution('')
        setFormAttachments([])
        setMsg({ type: 'success', text: '✅ 您的提案已成功送出！老闆審批後將即刻啟動程式改寫。' })
        setTimeout(() => setMsg(null), 5000)
        loadData()
      } else {
        alert(data.error || '送出失敗')
      }
    } catch {
      alert('送出失敗，請重試')
    } finally {
      setSubmitting(false)
    }
  }

  // 審核操作（老闆專用）
  const handleReview = async (id: string, newStatus: 'approved' | 'in_progress' | 'completed' | 'rejected') => {
    setUpdatingId(id)
    try {
      const notes = actionNotes[id] || ''
      const res = await fetch('/api/office/proposals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: newStatus,
          admin_notes: notes,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg({
          type: 'success',
          text: newStatus === 'approved'
            ? '🚀 已批准該提案！AI 程式重寫任務規格書已自動生成，可即刻啟動程式改寫。'
            : newStatus === 'completed'
            ? '🎉 已標記該功能程式改寫完成並上線！'
            : '已更新提案審核狀態。'
        })
        setTimeout(() => setMsg(null), 5000)
        loadData()
      } else {
        alert(data.error || '操作失敗')
      }
    } catch {
      alert('更新失敗，請檢查網路')
    } finally {
      setUpdatingId(null)
    }
  }

  // 複製 AI 重寫規格提示詞
  const handleCopyAiPrompt = (p: Proposal) => {
    if (!p.ai_plan) return
    navigator.clipboard.writeText(p.ai_plan)
    setCopiedId(p.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  // 統計數據
  const totalCount = proposals.length
  const pendingCount = proposals.filter(p => p.status === 'pending').length
  const approvedCount = proposals.filter(p => p.status === 'approved').length
  const inProgressCount = proposals.filter(p => p.status === 'in_progress').length
  const completedCount = proposals.filter(p => p.status === 'completed').length

  // 依條件過濾
  const filtered = proposals.filter(p => {
    if (statusFilter === 'mine' && p.user_id !== currentUserId) return false
    if (statusFilter !== 'all' && statusFilter !== 'mine' && p.status !== statusFilter) return false
    if (deptFilter !== 'all' && p.department !== deptFilter) return false
    if (typeFilter !== 'all' && p.type !== typeFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const match =
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.author_name.toLowerCase().includes(q) ||
        (p.store_code && p.store_code.toLowerCase().includes(q))
      if (!match) return false
    }
    return true
  })

  return (
    <div className="space-y-5">
      {/* 訊息提示 */}
      {msg && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
          msg.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
            : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* 頂部提案中樞看板與數據卡 */}
      <Card className="p-5 bg-gradient-to-br from-amber-500/5 via-card to-card border border-amber-500/20 shadow-xs relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600">
                <Lightbulb className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                全體問題與想法提案中樞
              </h2>
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-300 font-normal">
                老闆審批後自動啟動寫程式
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              任何部門同仁皆可在此提出系統問題、操作痛點或創新想法；負責人審批批准後，將即刻依指示改寫程式並更新上線。
            </p>
          </div>

          <Button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold gap-1.5 shadow-sm px-4"
          >
            <Plus className="h-4 w-4" />
            提出問題或想法
          </Button>
        </div>

        {/* 狀態數據小卡 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4 pt-4 border-t border-dashed">
          <button
            onClick={() => setStatusFilter('all')}
            className={`p-2.5 rounded-xl border text-left transition-all ${statusFilter === 'all' ? 'bg-muted border-primary/50 ring-1 ring-primary/40' : 'bg-card hover:bg-muted/40'}`}
          >
            <span className="text-[11px] text-muted-foreground font-medium block">全部提案</span>
            <span className="text-lg font-bold text-foreground">{totalCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('pending')}
            className={`p-2.5 rounded-xl border text-left transition-all ${statusFilter === 'pending' ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 ring-1 ring-amber-400' : 'bg-card hover:bg-amber-50/30'}`}
          >
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" />待審批
            </span>
            <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{pendingCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('approved')}
            className={`p-2.5 rounded-xl border text-left transition-all ${statusFilter === 'approved' ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 ring-1 ring-blue-400' : 'bg-card hover:bg-blue-50/30'}`}
          >
            <span className="text-[11px] text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1">
              <Sparkles className="h-3 w-3" />已批准改寫
            </span>
            <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{approvedCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`p-2.5 rounded-xl border text-left transition-all ${statusFilter === 'in_progress' ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-300 ring-1 ring-purple-400' : 'bg-card hover:bg-purple-50/30'}`}
          >
            <span className="text-[11px] text-purple-700 dark:text-purple-400 font-medium flex items-center gap-1">
              <Loader2 className="h-3 w-3" />程式改寫中
            </span>
            <span className="text-lg font-bold text-purple-700 dark:text-purple-300">{inProgressCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('completed')}
            className={`p-2.5 rounded-xl border text-left transition-all ${statusFilter === 'completed' ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 ring-1 ring-emerald-400' : 'bg-card hover:bg-emerald-50/30'}`}
          >
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />已完成上線
            </span>
            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{completedCount}</span>
          </button>
        </div>
      </Card>

      {/* 篩選工具列 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* 部門篩選 */}
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="h-8 rounded-lg border bg-background px-2.5 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary"
          >
            <option value="all">全部部門模組</option>
            {DEPARTMENTS.map(d => (
              <option key={d.key} value={d.key}>{d.icon} {d.label}</option>
            ))}
          </select>

          {/* 類型篩選 */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="h-8 rounded-lg border bg-background px-2.5 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary"
          >
            <option value="all">全部提案類型</option>
            <option value="problem">🚨 問題回報 (Problem)</option>
            <option value="idea">💡 想法建議 (Idea)</option>
          </select>

          <button
            onClick={() => setStatusFilter(f => f === 'mine' ? 'all' : 'mine')}
            className={`h-8 px-2.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1 ${
              statusFilter === 'mine' ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            <User className="h-3 w-3" />我提出的
          </button>
        </div>

        {/* 搜尋與重新載入 */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="搜尋提案標題、同仁或內容…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 w-44 sm:w-56 text-xs"
          />
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="h-8 px-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 提案清單卡片 */}
      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          正在載入全體問題與想法提案…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-xs text-muted-foreground space-y-2">
          <p>尚無符合篩選條件的提案記錄。</p>
          <Button variant="outline" size="sm" onClick={() => setShowModal(true)} className="text-xs">
            + 立即提出第一個問題或想法
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const isMine = p.user_id === currentUserId
            const isExpanded = expandedIds.has(p.id)
            const deptObj = DEPARTMENTS.find(d => d.key === p.department)

            return (
              <Card
                key={p.id}
                className={`p-4 space-y-3 border transition-all ${
                  p.status === 'pending'
                    ? 'border-amber-200/80 dark:border-amber-900/40 bg-card'
                    : p.status === 'approved'
                    ? 'border-blue-200/80 dark:border-blue-900/40 bg-blue-500/[0.02]'
                    : p.status === 'completed'
                    ? 'border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-500/[0.02]'
                    : 'border-border bg-card'
                }`}
              >
                {/* 卡片標頭列 */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 類型標籤 */}
                    <Badge
                      className={`gap-1 text-[11px] font-semibold px-2 py-0.5 border ${
                        p.type === 'problem'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300'
                      }`}
                    >
                      {p.type === 'problem' ? '🚨 問題回報' : '💡 想法建議'}
                    </Badge>

                    {/* 部門標籤 */}
                    <Badge variant="outline" className="text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-muted/50">
                      {deptObj?.icon} {p.department_label || deptObj?.label || p.department}
                    </Badge>

                    {/* 門市代碼 */}
                    {p.store_code && (
                      <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-400 border-amber-300 bg-amber-500/10">
                        🏪 [{p.store_code}]
                      </Badge>
                    )}

                    {/* 狀態標籤 */}
                    <Badge
                      className={`text-[11px] font-semibold px-2.5 py-0.5 border ${
                        p.status === 'pending'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300'
                          : p.status === 'approved'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300'
                          : p.status === 'in_progress'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300'
                          : p.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {p.status === 'pending' && '⏳ 待老闆審核'}
                      {p.status === 'approved' && '🚀 老闆已批准・可開始寫程式'}
                      {p.status === 'in_progress' && '⚙️ 程式改寫中'}
                      {p.status === 'completed' && '✅ 程式已改寫完成並上線'}
                      {p.status === 'rejected' && '✕ 暫不採納'}
                    </Badge>
                  </div>

                  {/* 提案人與時間 */}
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span>
                      由 <strong>{p.author_name}</strong> {isMine && '(您)'} 提出
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(p.created_at).toLocaleString('zh-TW', {
                        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>

                {/* 標題 */}
                <h3 className="text-sm font-bold text-foreground">
                  {p.title}
                </h3>

                {/* 問題/想法描述 */}
                <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 p-2.5 rounded-lg border">
                  {p.description}
                </div>

                {/* 期望做法 */}
                {p.expected_solution && (
                  <div className="text-xs space-y-1 bg-primary/5 border border-primary/20 p-2.5 rounded-lg">
                    <span className="font-semibold text-primary block">✨ 期望做法與建議：</span>
                    <p className="text-foreground whitespace-pre-wrap">{p.expected_solution}</p>
                  </div>
                )}

                {/* 附件截圖 */}
                {p.attachments && p.attachments.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5" />截圖附件：
                    </span>
                    {p.attachments.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline bg-muted px-2 py-1 rounded border"
                      >
                        <ImageIcon className="h-3 w-3" />截圖 {i + 1} <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ))}
                  </div>
                )}

                {/* 老闆批示與 AI 重寫規格 */}
                {p.admin_notes && (
                  <div className="text-xs bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg text-amber-900 dark:text-amber-200">
                    <span className="font-semibold flex items-center gap-1 mb-0.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                      負責人批示備註：
                    </span>
                    <p>{p.admin_notes}</p>
                  </div>
                )}

                {/* 已批准後的 AI 程式改寫任務提示詞 */}
                {p.ai_plan && (
                  <div className="text-xs bg-slate-900 text-slate-100 p-3 rounded-xl space-y-2 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        AI 程式改寫指令規格書 (可一鍵複製給 AI 開始寫程式)
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCopyAiPrompt(p)}
                        className="h-6 text-[10px] px-2 gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200"
                      >
                        {copiedId === p.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        {copiedId === p.id ? '已複製！' : '複製提示詞'}
                      </Button>
                    </div>
                    <pre className="text-[11px] font-mono whitespace-pre-wrap text-slate-300 leading-relaxed max-h-40 overflow-y-auto bg-black/40 p-2 rounded">
                      {p.ai_plan}
                    </pre>
                  </div>
                )}

                {/* 老闆專屬審核操作工具列 */}
                {canManage && (
                  <div className="pt-2 border-t mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex-1 min-w-[200px] flex items-center gap-2">
                      <Input
                        placeholder="批示指引 (例: 同意，請新增至門市報表並更新計算邏輯)"
                        value={actionNotes[p.id] || ''}
                        onChange={e => setActionNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {p.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            disabled={updatingId === p.id}
                            onClick={() => handleReview(p.id, 'approved')}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
                          >
                            {updatingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            ✅ 批准並開始寫程式
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updatingId === p.id}
                            onClick={() => handleReview(p.id, 'rejected')}
                            className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                          >
                            ✕ 暫不採納
                          </Button>
                        </>
                      )}

                      {p.status === 'approved' && (
                        <>
                          <Button
                            size="sm"
                            disabled={updatingId === p.id}
                            onClick={() => handleReview(p.id, 'in_progress')}
                            className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-1"
                          >
                            ⚙️ 標記改寫中
                          </Button>
                          <Button
                            size="sm"
                            disabled={updatingId === p.id}
                            onClick={() => handleReview(p.id, 'completed')}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
                          >
                            🎉 標記已完成上線
                          </Button>
                        </>
                      )}

                      {p.status === 'in_progress' && (
                        <Button
                          size="sm"
                          disabled={updatingId === p.id}
                          onClick={() => handleReview(p.id, 'completed')}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
                        >
                          🎉 標記已完成上線
                        </Button>
                      )}

                      {p.status === 'completed' && (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />已完成部署
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* 提交新提案彈窗 (Modal) */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-lg w-full p-6 space-y-4 shadow-xl border relative bg-card my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600">
                  <Lightbulb className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">提出問題或改進想法</h3>
                  <p className="text-[11px] text-muted-foreground">提交後由負責人審閱，批准後將即刻啟動程式改寫</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* 類型選擇 */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">提案類型 *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('idea')}
                    className={`p-3 rounded-xl border flex items-center gap-2 transition-all text-left ${
                      formType === 'idea'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-800 dark:text-amber-200 ring-1 ring-amber-400'
                        : 'bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Lightbulb className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="font-bold">💡 想法建議</div>
                      <div className="text-[10px] opacity-75">新功能、流程優化、更方便的做法</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('problem')}
                    className={`p-3 rounded-xl border flex items-center gap-2 transition-all text-left ${
                      formType === 'problem'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-800 dark:text-rose-200 ring-1 ring-rose-400'
                        : 'bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <div>
                      <div className="font-bold">🚨 問題回報</div>
                      <div className="text-[10px] opacity-75">系統錯誤、計算異常、操作卡住</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 相關部門 */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">相關部門 / 模組 *</label>
                <select
                  value={formDept}
                  onChange={e => setFormDept(e.target.value)}
                  className="w-full h-9 rounded-lg border bg-background px-3 text-xs font-medium"
                >
                  {DEPARTMENTS.map(d => (
                    <option key={d.key} value={d.key}>{d.icon} {d.label}</option>
                  ))}
                </select>
              </div>

              {/* 提案標題 */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  {formType === 'problem' ? '問題摘要標題 *' : '想法建議標題 *'}
                </label>
                <Input
                  required
                  placeholder={formType === 'problem' ? '例：門市水電費上傳照片無法預覽' : '例：希望在出納總務增加 Excel 批次匯出'}
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* 詳細內容 */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  {formType === 'problem' ? '問題詳細描述與發生時機 *' : '想法詳細說明與好處 *'}
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={formType === 'problem' ? '請描述遇到什麼狀況、操作步驟、哪家門市或哪個科目出錯…' : '請描述希望增加什麼功能，對門市或部門有什麼幫助…'}
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  className="w-full rounded-lg border bg-background p-2.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              {/* 期望做法 */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">期望改寫做法或功能設計 (可選)</label>
                <textarea
                  rows={2}
                  placeholder="希望系統怎麼做？或是您覺得最方便的操作方式是什麼？"
                  value={formSolution}
                  onChange={e => setFormSolution(e.target.value)}
                  className="w-full rounded-lg border bg-background p-2.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              {/* 截圖附件上傳 */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground flex items-center justify-between">
                  <span>截圖或照片憑證 (可選)</span>
                  {uploadingImg && <span className="text-[11px] text-amber-600 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />上傳中...</span>}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload(f)
                  }}
                />

                <div className="flex items-center gap-2 flex-wrap">
                  {formAttachments.map((url, i) => (
                    <div key={i} className="relative group border rounded-lg overflow-hidden h-14 w-14 bg-muted">
                      <img src={url} alt="截圖" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormAttachments(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingImg}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-14 px-3 border-dashed gap-1 text-xs"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    選擇截圖
                  </Button>
                </div>
              </div>

              {/* 底部動作列 */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowModal(false)} disabled={submitting}>
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !formTitle.trim() || !formDesc.trim()}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5 px-5"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  確認送出提案
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
