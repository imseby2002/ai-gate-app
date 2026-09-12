'use client'
import { useState, useEffect } from 'react'
import {
  GitBranch, Loader2, RefreshCw, ExternalLink, Zap,
  CheckCircle2, Clock, AlertCircle, MessageSquare,
  Sparkles, Check, Code2, Play, ChevronDown, ChevronUp,
  FileCode, DollarSign, Building2
} from 'lucide-react'

type FbType = 'bug' | 'feature' | 'text_change' | 'ai_error' | 'other'
type FbStatus = 'pending' | 'awaiting_approval' | 'processing' | 'pr_ready' | 'suggestion' | 'rejected' | 'merged'

interface Feedback {
  id: string
  title: string
  description: string
  type: FbType
  status: FbStatus
  complexity: string | null
  ai_plan: string | null
  branch_name: string | null
  pr_url: string | null
  preview_url: string | null
  admin_notes: string | null
  error_log: string | null
  created_at: string
  source: string | null
  contact: string | null
  is_paid: boolean
  price_quote_usd: number | null
  profiles?: { email: string; full_name: string | null }
  companies?: { id: string; name: string } | { id: string; name: string }[] | null
}

const STATUS_CONFIG: Record<FbStatus, { label: string; badgeClass: string }> = {
  pending:           { label: '待排程處理',      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
  awaiting_approval: { label: '⏸️ 等我確認施作', badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-bold' },
  processing:        { label: '🔄 Claude 施作中', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' },
  pr_ready:          { label: '⚡ PR 待合併',     badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' },
  suggestion:        { label: '💡 需人工架構重構', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  rejected:          { label: '已關閉 / 拒絕',    badgeClass: 'bg-slate-100 text-slate-400 border-slate-200' },
  merged:            { label: '✅ 已合併上線',    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
}

const TYPE_CONFIG: Record<FbType, { label: string; icon: string }> = {
  bug:         { label: '系統錯誤 (Bug)',   icon: '🐛' },
  ai_error:    { label: 'AI 回應異常',     icon: '🤖' },
  text_change: { label: 'UI / 視覺調整',   icon: '🎨' },
  feature:     { label: '新功能開發需求',  icon: '✨' },
  other:       { label: '其他綜合回饋',    icon: '💬' },
}

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks]     = useState<Feedback[]>([])
  const [loading, setLoading]         = useState(true)
  const [processing, setProcessing]   = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [notes, setNotes]             = useState<Record<string, string>>({})
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({})
  const [editTitle, setEditTitle]     = useState<Record<string, string>>({})
  const [editDesc, setEditDesc]       = useState<Record<string, string>>({})
  const [approving, setApproving]     = useState<string | null>(null)
  const [merging, setMerging]         = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const d = await fetch('/api/feedback').then(r => r.json()).catch(() => ({}))
      setFeedbacks(d.feedbacks ?? [])
    } finally {
      setLoading(false)
    }
  }

  // 手動觸發 Claude 3.7 Sonnet 施作代碼
  async function processAutoFix(id: string) {
    setProcessing(id)
    try {
      const r = await fetch(`/api/feedback/${id}`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) {
        alert(d.error ?? 'Claude 3.7 Sonnet 施作失敗，請查看錯誤紀錄')
      }
      await load()
    } finally {
      setProcessing(null)
    }
  }

  // 狀態快速更新
  async function updateStatus(id: string, status: string) {
    await fetch(`/api/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status: status as FbStatus } : f))
  }

  // 儲存管理者備註
  async function saveNotes(id: string) {
    await fetch(`/api/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_notes: notes[id] ?? '' }),
    })
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, admin_notes: notes[id] ?? '' } : f))
  }

  // 核准「等我確認施作」的項目：可修正標題、限縮需求範圍、填報價，核准後即刻啟動 Claude 3.7 Sonnet 改 code 建 PR
  async function approveAndExecute(fb: Feedback) {
    setApproving(fb.id)
    try {
      const body: Record<string, unknown> = { approve: true }
      const price = priceInputs[fb.id]
      if (price !== undefined && price.trim() !== '') body.price_quote_usd = Number(price)
      if (editTitle[fb.id] !== undefined) body.title = editTitle[fb.id]
      if (editDesc[fb.id] !== undefined) body.description = editDesc[fb.id]

      const res = await fetch(`/api/feedback/${fb.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? '核准與啟動失敗')
      }
      await load()
    } finally {
      setApproving(null)
    }
  }

  // 一鍵確認 Squash Merge GitHub PR
  async function confirmMerge(id: string) {
    if (!confirm('確定要將 Claude 3.7 Sonnet 產生的修改一鍵 Squash Merge 到 GitHub main 分支嗎？')) {
      return
    }
    setMerging(id)
    try {
      const r = await fetch(`/api/feedback/${id}/merge`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) {
        alert(d.error ?? '合併失敗，請手動檢查 GitHub PR')
        return
      }
      await load()
    } finally {
      setMerging(null)
    }
  }

  // 篩選列表
  const filtered = feedbacks.filter(f => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'confirm_needed') return f.status === 'awaiting_approval'
    if (statusFilter === 'pr_ready') return f.status === 'pr_ready'
    return f.status === statusFilter
  })

  const countConfirm = feedbacks.filter(f => f.status === 'awaiting_approval').length
  const countPrReady = feedbacks.filter(f => f.status === 'pr_ready').length
  const countProcessing = feedbacks.filter(f => f.status === 'processing').length

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* 頂部標題與核心模型宣告卡片 */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">使用者回饋與自動修復管理</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  彙整各模組與網頁／APP 的問題回報，由 Claude 3.7 Sonnet 全自動精準分析與編寫程式碼
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* 核心程式碼模型 Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200/90 text-purple-900 text-xs font-semibold shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-purple-600 animate-pulse" />
              <span>程式碼修改核心：<strong className="text-purple-700">Claude 3.7 Sonnet</strong> (Anthropic 官方)</span>
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shadow-2xs cursor-pointer"
              title="重新整理列表"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* 雙軌工作模式說明條 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-100">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/70 text-emerald-950">
            <span className="text-base leading-none mt-0.5">⚡</span>
            <div>
              <div className="font-bold text-emerald-900">模式一：直接施作，等我合併（全自動）</div>
              <div className="text-emerald-700/90 mt-0.5 leading-relaxed">
                適用於 <strong>Bug 錯誤、AI 回應異常、免費用戶調整</strong>。系統收到後自動調用 Claude 3.7 Sonnet 開分支寫代碼並提交 PR，您只需在後台預覽測試與一鍵確認合併。
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-950">
            <span className="text-base leading-none mt-0.5">⏸️</span>
            <div>
              <div className="font-bold text-amber-900">模式二：等我確認開始施作（審核控制）</div>
              <div className="text-amber-800/90 mt-0.5 leading-relaxed">
                適用於 <strong>新功能需求、需計費項目或手動指定</strong>。系統先凍結不碰程式碼，由您在下方確認修改範圍或報價，點擊「核准並立即施作」後才喚醒 Claude Sonnet 執行。
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 篩選標籤 (Tabs) */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setStatusFilter('all')}
          className={`text-xs px-3.5 py-1.5 rounded-xl border font-semibold transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          全部 ({feedbacks.length})
        </button>

        <button
          onClick={() => setStatusFilter('confirm_needed')}
          className={`text-xs px-3.5 py-1.5 rounded-xl border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            statusFilter === 'confirm_needed'
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
              : 'bg-amber-50/80 border-amber-200 text-amber-800 hover:bg-amber-100'
          }`}
        >
          <span>⏸️ 等我確認施作</span>
          {countConfirm > 0 && (
            <span className="h-4 min-w-4 px-1 rounded-full bg-amber-200 text-amber-900 text-[10px] flex items-center justify-center font-black">
              {countConfirm}
            </span>
          )}
        </button>

        <button
          onClick={() => setStatusFilter('pr_ready')}
          className={`text-xs px-3.5 py-1.5 rounded-xl border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            statusFilter === 'pr_ready'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-emerald-50/80 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
          }`}
        >
          <span>⚡ 直接施作 · 待合併 PR</span>
          {countPrReady > 0 && (
            <span className="h-4 min-w-4 px-1 rounded-full bg-emerald-200 text-emerald-900 text-[10px] flex items-center justify-center font-black">
              {countPrReady}
            </span>
          )}
        </button>

        {countProcessing > 0 && (
          <button
            onClick={() => setStatusFilter('processing')}
            className={`text-xs px-3.5 py-1.5 rounded-xl border font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'processing'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Claude 施作中 ({countProcessing})</span>
          </button>
        )}

        <button
          onClick={() => setStatusFilter('suggestion')}
          className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all cursor-pointer ${
            statusFilter === 'suggestion'
              ? 'bg-purple-600 text-white border-purple-600'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          💡 建議記錄 ({feedbacks.filter(f => f.status === 'suggestion').length})
        </button>

        <button
          onClick={() => setStatusFilter('merged')}
          className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all cursor-pointer ${
            statusFilter === 'merged'
              ? 'bg-slate-700 text-white border-slate-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          ✅ 已合併 ({feedbacks.filter(f => f.status === 'merged').length})
        </button>

        <button
          onClick={() => setStatusFilter('rejected')}
          className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all cursor-pointer ${
            statusFilter === 'rejected'
              ? 'bg-slate-500 text-white border-slate-500'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          已關閉 ({feedbacks.filter(f => f.status === 'rejected').length})
        </button>
      </div>

      {/* 回饋卡片列表 */}
      {loading ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">正在讀取回饋與 PR 狀態...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-2">
          <CheckCircle2 className="h-10 w-10 mx-auto text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">目前沒有符合條件的回饋紀錄</p>
          <p className="text-xs text-slate-400">當使用者在任何模組送出意見反映，系統將自動分類並呈現在此</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(fb => {
            const isAwaiting = fb.status === 'awaiting_approval'
            const isPrReady = fb.status === 'pr_ready'
            const typeInfo = TYPE_CONFIG[fb.type] ?? { label: fb.type, icon: '💬' }
            const statusInfo = STATUS_CONFIG[fb.status] ?? { label: fb.status, badgeClass: 'bg-slate-100 text-slate-700' }
            const isProcessingThis = processing === fb.id || (fb.status === 'processing' && !processing)

            return (
              <div
                key={fb.id}
                className={`bg-white border rounded-2xl p-5 space-y-4 transition-all shadow-xs ${
                  isAwaiting
                    ? 'border-amber-300 ring-2 ring-amber-100/80 bg-gradient-to-b from-amber-50/20 to-white'
                    : isPrReady
                    ? 'border-emerald-300 ring-2 ring-emerald-100/80 bg-gradient-to-b from-emerald-50/20 to-white'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* 第一列：模式識別標籤、類型、當前狀態 */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 關鍵模式識別徽章 */}
                    {isAwaiting ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 text-xs font-black shadow-2xs">
                        <span>⏸️ 等我確認開始施作</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs font-bold shadow-2xs">
                        <span>⚡ 直接施作 · 等我合併</span>
                      </span>
                    )}

                    {/* 回饋類型 */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold">
                      <span>{typeInfo.icon}</span>
                      <span>{typeInfo.label}</span>
                    </span>

                    {/* 當前生命週期狀態 */}
                    <span className={`text-[11px] px-2.5 py-0.8 rounded-lg border font-semibold ${statusInfo.badgeClass}`}>
                      {statusInfo.label}
                    </span>

                    {/* 自動化判斷 */}
                    {fb.complexity && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${
                        fb.complexity === 'auto'
                          ? 'bg-teal-50 text-teal-800 border-teal-200'
                          : 'bg-purple-50 text-purple-800 border-purple-200'
                      }`}>
                        {fb.complexity === 'auto' ? '⚡ 支援 AI 自動改碼' : '🔧 涉及核心架構'}
                      </span>
                    )}

                    {/* 計費標記 */}
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${
                      fb.is_paid
                        ? 'bg-rose-50 text-rose-800 border-rose-200 font-semibold'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {fb.is_paid ? `💰 需計費${fb.price_quote_usd != null ? ` $${fb.price_quote_usd}` : ''}` : '🆓 免費額度'}
                    </span>
                  </div>

                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(fb.created_at).toLocaleString('zh-TW', { hour12: false })}
                  </span>
                </div>

                {/* 第二列：標題與詳細描述展開 */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {fb.title}
                    </h3>
                    <button
                      onClick={() => setExpanded(expanded === fb.id ? null : fb.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 shrink-0 cursor-pointer pt-0.5"
                    >
                      <span>{expanded === fb.id ? '收起完整描述' : '展開完整描述'}</span>
                      {expanded === fb.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {expanded === fb.id ? (
                    <div className="mt-2.5 text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-200/70 rounded-xl p-3.5 leading-relaxed font-mono">
                      {fb.description}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {fb.description}
                    </p>
                  )}
                </div>

                {/* 提交者與公司來源資訊 */}
                {(fb.profiles?.email || fb.companies || fb.source || fb.contact) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                    {fb.profiles?.email && (
                      <span className="flex items-center gap-1 font-medium text-slate-800">
                        <span>👤 提交者：</span>
                        <span>{fb.profiles.full_name || fb.profiles.email}</span>
                        <span className="text-slate-500 font-mono text-[11px]">({fb.profiles.email})</span>
                      </span>
                    )}

                    {(() => {
                      const comp = Array.isArray(fb.companies) ? fb.companies[0] : fb.companies
                      return comp?.name ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/80">
                          <Building2 className="h-3 w-3" />
                          <span>{comp.name}</span>
                        </span>
                      ) : null
                    })()}

                    {fb.source && (
                      <span className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/70 font-medium">
                        來源：{fb.source}
                      </span>
                    )}

                    {fb.contact && (
                      <span className="text-slate-600 font-mono">
                        聯絡：{fb.contact}
                      </span>
                    )}
                  </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    【控制模式 A】：等我確認開始施作 (awaiting_approval)
                    顯示專屬審核確認卡片，管理者可修改範圍、自訂報價，點擊立即施作
                    ───────────────────────────────────────────────────────────── */}
                {isAwaiting && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50/50 p-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                        <span className="text-xs font-bold text-amber-900">
                          審核控制面板（確認後才會開始調用 Claude 3.7 Sonnet 施作）
                        </span>
                      </div>
                      <span className="text-[11px] text-amber-700 font-medium">
                        可先行修正標題與修改範圍，防止 AI 改動過多檔案
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-amber-900">修改範圍標題：</label>
                        <input
                          value={editTitle[fb.id] ?? fb.title}
                          onChange={e => setEditTitle(p => ({ ...p, [fb.id]: e.target.value }))}
                          className="w-full text-xs border border-amber-200 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="調整標題..."
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-amber-900">修改內容細節與限定檔案範圍：</label>
                        <textarea
                          value={editDesc[fb.id] ?? fb.description}
                          onChange={e => setEditDesc(p => ({ ...p, [fb.id]: e.target.value }))}
                          rows={3}
                          className="w-full text-xs border border-amber-200 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none font-mono"
                          placeholder="可具體指定需修改的檔案路徑或限制範圍..."
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <div className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-lg px-3 py-1.5">
                          <DollarSign className="h-3.5 w-3.5 text-amber-600" />
                          <span className="text-xs text-slate-600 font-semibold">報價金額：</span>
                          <input
                            type="number"
                            value={priceInputs[fb.id] ?? (fb.price_quote_usd ?? '')}
                            onChange={e => setPriceInputs(p => ({ ...p, [fb.id]: e.target.value }))}
                            placeholder="0"
                            className="w-20 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                          />
                          <span className="text-xs text-slate-400">USD</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-amber-200/80">
                      <button
                        onClick={() => updateStatus(fb.id, 'rejected')}
                        className="text-xs px-3.5 py-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl transition-all font-semibold cursor-pointer"
                      >
                        拒絕此需求
                      </button>

                      <button
                        onClick={() => approveAndExecute(fb)}
                        disabled={approving === fb.id}
                        className="flex items-center gap-2 text-xs px-4 py-2 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {approving === fb.id ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Claude 3.7 Sonnet 正在讀取程式碼並施作中...</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5 fill-current" />
                            <span>核准並立即由 Claude 3.7 Sonnet 施作</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    【控制模式 B】：直接施作完成，等我合併 (pr_ready)
                    顯示綠色就緒卡片，提供 Vercel 實體測試與一鍵 GitHub Squash Merge
                    ───────────────────────────────────────────────────────────── */}
                {isPrReady && (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-950">
                          Claude 3.7 Sonnet 已完成代碼修復，PR 已就緒！
                        </span>
                      </div>
                      {fb.branch_name && (
                        <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                          分支：{fb.branch_name}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      {/* 一鍵確認合併按鈕 */}
                      <button
                        onClick={() => confirmMerge(fb.id)}
                        disabled={merging === fb.id}
                        className="flex items-center gap-2 text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {merging === fb.id ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>自動合併中 (Squash Merge)...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>確認合併 (一鍵 Squash Merge 到 main)</span>
                          </>
                        )}
                      </button>

                      {/* Vercel Preview 測試按鈕 */}
                      {fb.preview_url && (
                        <a
                          href={fb.preview_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs px-3.5 py-2 bg-white text-emerald-800 border border-emerald-300 rounded-xl hover:bg-emerald-50 font-bold transition-all shadow-2xs"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Vercel 預覽測試</span>
                        </a>
                      )}

                      {/* GitHub PR 查看按鈕 */}
                      {fb.pr_url && (
                        <a
                          href={fb.pr_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs px-3.5 py-2 bg-slate-900 text-white rounded-xl hover:bg-black font-semibold transition-all shadow-2xs"
                        >
                          <GitBranch className="h-3.5 w-3.5" />
                          <span>GitHub PR 檢閱 Diff</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* AI 分析計畫或錯誤顯示 */}
                {fb.ai_plan && (
                  <div className="text-xs text-indigo-950 bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3 space-y-1">
                    <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <Code2 className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Claude 3.7 Sonnet 分析計畫：</span>
                    </div>
                    <p className="text-indigo-800 leading-relaxed pl-5">{fb.ai_plan}</p>
                  </div>
                )}

                {fb.error_log && (
                  <div className="text-xs text-rose-950 bg-rose-50/80 border border-rose-200 rounded-xl p-3 space-y-1">
                    <div className="font-bold text-rose-800 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                      <span>執行異常紀錄：</span>
                    </div>
                    <p className="text-rose-700 font-mono text-[11px] pl-5 break-all">{fb.error_log}</p>
                  </div>
                )}

                {/* 管理者備註 */}
                <div className="flex gap-2 items-center pt-1">
                  <input
                    value={notes[fb.id] ?? (fb.admin_notes ?? '')}
                    onChange={e => setNotes(p => ({ ...p, [fb.id]: e.target.value }))}
                    placeholder="輸入管理者備注（使用者在其回饋進度中可見）..."
                    className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-800"
                  />
                  <button
                    onClick={() => saveNotes(fb.id)}
                    className="text-xs px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    儲存備註
                  </button>
                </div>

                {/* 底部輔助控制按鈕 */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    {/* 若非 awaiting_approval 且尚未 merged，允許手動強制呼叫 Claude 3.7 Sonnet 重新施作 */}
                    {!isAwaiting && fb.status !== 'merged' && (
                      <button
                        onClick={() => processAutoFix(fb.id)}
                        disabled={isProcessingThis}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {isProcessingThis ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Claude 施作中...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="h-3.5 w-3.5 text-indigo-600" />
                            <span>{fb.status === 'pr_ready' ? '重新由 Claude 修改' : '立即由 Claude 3.7 Sonnet 施作'}</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* 允許將直接施作的項目切換為「等我確認」 */}
                    {fb.status === 'pending' && (
                      <button
                        onClick={() => updateStatus(fb.id, 'awaiting_approval')}
                        className="text-xs px-2.5 py-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg font-semibold transition-colors cursor-pointer"
                      >
                        切換為「等我確認施作」
                      </button>
                    )}
                  </div>

                  {/* 關閉或標記為已處理 */}
                  <div className="flex items-center gap-2">
                    {fb.status !== 'rejected' && fb.status !== 'merged' && (
                      <button
                        onClick={() => updateStatus(fb.id, 'rejected')}
                        className="text-xs px-2.5 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        關閉此案
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
