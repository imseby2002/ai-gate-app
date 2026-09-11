'use client'
import { useState, useEffect } from 'react'
import { GitBranch, Loader2, RefreshCw, ExternalLink, Zap, CheckCircle2, Clock, AlertCircle, MessageSquare } from 'lucide-react'

type FbType = 'bug' | 'feature' | 'text_change' | 'ai_error' | 'other'
type FbStatus = 'pending' | 'awaiting_approval' | 'processing' | 'pr_ready' | 'suggestion' | 'rejected' | 'merged'

interface Feedback {
  id: string; title: string; description: string; type: FbType; status: FbStatus
  complexity: string | null; ai_plan: string | null; branch_name: string | null
  pr_url: string | null; preview_url: string | null; admin_notes: string | null
  error_log: string | null; created_at: string; source: string | null
  contact: string | null; is_paid: boolean; price_quote_usd: number | null
  profiles?: { email: string; full_name: string | null }
  companies?: { id: string; name: string } | { id: string; name: string }[] | null
}

const STATUS_COLORS: Record<FbStatus, string> = {
  pending:           'bg-gray-100 text-gray-600',
  awaiting_approval: 'bg-orange-100 text-orange-700',
  processing:        'bg-amber-100 text-amber-700',
  pr_ready:          'bg-emerald-100 text-emerald-700',
  suggestion:        'bg-indigo-100 text-indigo-700',
  rejected:          'bg-gray-100 text-gray-400',
  merged:            'bg-green-100 text-green-700',
}
const STATUS_LABELS: Record<FbStatus, string> = {
  pending: '待處理', awaiting_approval: '待審核（計費）', processing: '處理中', pr_ready: 'PR 已建立',
  suggestion: '建議記錄', rejected: '已關閉', merged: '已合併',
}
const TYPE_LABELS: Record<FbType, string> = {
  bug: '🐛 錯誤', ai_error: '🤖 AI錯誤', text_change: '🎨 UI調整', feature: '✨ 新功能', other: '💬 其他',
}

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading]     = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({})
  const [editTitle, setEditTitle] = useState<Record<string, string>>({})
  const [editDesc, setEditDesc] = useState<Record<string, string>>({})
  const [approving, setApproving] = useState<string | null>(null)
  const [merging, setMerging] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const d = await fetch('/api/feedback').then(r => r.json()).catch(() => ({}))
    setFeedbacks(d.feedbacks ?? [])
    setLoading(false)
  }

  async function process(id: string) {
    setProcessing(id)
    try {
      const r = await fetch(`/api/feedback/${id}`, { method: 'POST' })
      const d = await r.json()
      if (d.ok || d.error) await load()
    } finally { setProcessing(null) }
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/feedback/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status: status as FbStatus } : f))
  }

  async function saveNotes(id: string) {
    await fetch(`/api/feedback/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_notes: notes[id] ?? '' }),
    })
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, admin_notes: notes[id] ?? '' } : f))
  }

  // 核准計費項目：可同時修正標題/內容範圍、填報價，核准後後端會直接觸發 AI 處理
  async function approve(fb: Feedback) {
    setApproving(fb.id)
    try {
      const body: Record<string, unknown> = { approve: true }
      const price = priceInputs[fb.id]
      if (price !== undefined && price.trim() !== '') body.price_quote_usd = Number(price)
      if (editTitle[fb.id] !== undefined) body.title = editTitle[fb.id]
      if (editDesc[fb.id] !== undefined) body.description = editDesc[fb.id]
      await fetch(`/api/feedback/${fb.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      await load()
    } finally {
      setApproving(null)
    }
  }

  async function confirmMerge(id: string) {
    setMerging(id)
    try {
      const r = await fetch(`/api/feedback/${id}/merge`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) { alert(d.error ?? '合併失敗'); return }
      await load()
    } finally {
      setMerging(null)
    }
  }

  const filtered = feedbacks.filter(f => statusFilter === 'all' || f.status === statusFilter)

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            使用者回饋管理
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">所有模組（AI 對話、行銷、客服、訂房、人事、出納、Agent…）與網頁版／手機 APP 的問題回報與功能建議統一彙整於此，用戶送出後 AI 自動處理。你只需：① 合併 GitHub PR  ② 手動解決「建議」類複雜需求</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 text-gray-500">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'awaiting_approval', 'pending', 'processing', 'pr_ready', 'suggestion', 'merged', 'rejected'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`text-[11px] px-3 py-1 rounded-full border font-medium transition-all ${
              statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}>
            {s === 'all' ? `全部 (${feedbacks.length})` : `${STATUS_LABELS[s as FbStatus]} (${feedbacks.filter(f => f.status === s).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400 border rounded-xl">無回饋記錄</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(fb => (
            <div key={fb.id} className="bg-white border rounded-xl p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start gap-2 flex-wrap">
                <span className="text-[11px] font-medium text-gray-500">{TYPE_LABELS[fb.type]}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[fb.status]}`}>
                  {STATUS_LABELS[fb.status]}
                </span>
                {fb.complexity && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${fb.complexity === 'auto' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                    {fb.complexity === 'auto' ? '⚡ 自動' : '🔧 需人工'}
                  </span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${fb.is_paid ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-700'}`}>
                  {fb.is_paid ? `💰 需計費${fb.price_quote_usd != null ? ` $${fb.price_quote_usd}` : ''}` : '🆓 免費'}
                </span>
                <span className="text-[10px] text-gray-400 ml-auto">{new Date(fb.created_at).toLocaleString('zh-TW')}</span>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  {fb.title}
                  <button onClick={() => setExpanded(expanded === fb.id ? null : fb.id)}
                    className="text-[10px] text-gray-400 hover:text-gray-600">
                    {expanded === fb.id ? '收起' : '展開'}
                  </button>
                </div>
                {expanded === fb.id && (
                  <div className="mt-2 text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                    {fb.description}
                  </div>
                )}
              </div>

              {(fb.profiles?.email || fb.companies || fb.source) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                  {fb.profiles?.email && (
                    <span>提交者：{fb.profiles.full_name ?? fb.profiles.email}（{fb.profiles.email}）</span>
                  )}
                  {(() => {
                    const comp = Array.isArray(fb.companies) ? fb.companies[0] : fb.companies
                    return comp?.name ? (
                      <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">{comp.name}</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">無所屬公司</span>
                    )
                  })()}
                  {fb.source && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 font-medium">
                      來源：{fb.source === 'mobile' ? '手機 APP' : fb.source}
                    </span>
                  )}
                  {fb.contact && <span>聯絡方式：{fb.contact}</span>}
                </div>
              )}

              {/* 計費項目待審核：可修正標題/內容範圍、填報價，再核准或拒絕 */}
              {fb.status === 'awaiting_approval' && (
                <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3 space-y-2">
                  <p className="text-[11px] font-medium text-orange-700">此項目需計費，需先核准才會開始處理</p>
                  <input
                    value={editTitle[fb.id] ?? fb.title}
                    onChange={e => setEditTitle(p => ({ ...p, [fb.id]: e.target.value }))}
                    className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                    placeholder="標題"
                  />
                  <textarea
                    value={editDesc[fb.id] ?? fb.description}
                    onChange={e => setEditDesc(p => ({ ...p, [fb.id]: e.target.value }))}
                    rows={3}
                    className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                    placeholder="內容（可修正範圍後再核准）"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500">報價 $</span>
                    <input
                      type="number"
                      value={priceInputs[fb.id] ?? (fb.price_quote_usd ?? '')}
                      onChange={e => setPriceInputs(p => ({ ...p, [fb.id]: e.target.value }))}
                      placeholder="美元"
                      className="w-24 text-xs border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </div>
                </div>
              )}

              {fb.ai_plan && (
                <div className="text-[11px] text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">
                  🤖 AI 計畫：{fb.ai_plan}
                </div>
              )}

              {fb.error_log && (
                <div className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  ❌ 錯誤：{fb.error_log.slice(0, 200)}
                </div>
              )}

              {/* PR ready links */}
              {fb.status === 'pr_ready' && (
                <div className="flex flex-wrap gap-2">
                  {fb.preview_url && (
                    <a href={fb.preview_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                      <ExternalLink className="h-3.5 w-3.5" />Vercel Preview
                    </a>
                  )}
                  {fb.pr_url && (
                    <a href={fb.pr_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900">
                      <GitBranch className="h-3.5 w-3.5" />GitHub PR → Merge
                    </a>
                  )}
                </div>
              )}

              {/* Admin notes */}
              <div className="flex gap-2">
                <input
                  value={notes[fb.id] ?? (fb.admin_notes ?? '')}
                  onChange={e => setNotes(p => ({ ...p, [fb.id]: e.target.value }))}
                  placeholder="管理者備注（用戶可見）"
                  className="flex-1 text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <button onClick={() => saveNotes(fb.id)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">
                  儲存備注
                </button>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {fb.status === 'awaiting_approval' && (
                  <button onClick={() => approve(fb)} disabled={approving === fb.id}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {approving === fb.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    {approving === fb.id ? '核准並送出 AI 處理中…' : '核准並開始處理'}
                  </button>
                )}
                {/* Retry: only for failed/stuck items */}
                {(fb.status === 'pending' || fb.status === 'suggestion') && (
                  <button onClick={() => process(fb.id)} disabled={processing === fb.id}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {processing === fb.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    {processing === fb.id ? 'AI 處理中…' : '重新嘗試 AI'}
                  </button>
                )}
                {fb.status === 'pr_ready' && (
                  <button onClick={() => confirmMerge(fb.id)} disabled={merging === fb.id}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                    {merging === fb.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {merging === fb.id ? '合併中…' : '確認合併'}
                  </button>
                )}
                {fb.status !== 'rejected' && fb.status !== 'merged' && (
                  <button onClick={() => updateStatus(fb.id, 'rejected')}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                    <AlertCircle className="h-3.5 w-3.5" />{fb.status === 'awaiting_approval' ? '拒絕' : '關閉'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
