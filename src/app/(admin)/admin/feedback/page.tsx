'use client'
import { useState, useEffect } from 'react'
import { GitBranch, Loader2, RefreshCw, ExternalLink, Zap, CheckCircle2, Clock, AlertCircle, MessageSquare } from 'lucide-react'

type FbType = 'bug' | 'feature' | 'text_change' | 'ai_error'
type FbStatus = 'pending' | 'processing' | 'pr_ready' | 'suggestion' | 'rejected' | 'merged'

interface Feedback {
  id: string; title: string; description: string; type: FbType; status: FbStatus
  complexity: string | null; ai_plan: string | null; branch_name: string | null
  pr_url: string | null; preview_url: string | null; admin_notes: string | null
  error_log: string | null; created_at: string
  profiles?: { email: string }
}

const STATUS_COLORS: Record<FbStatus, string> = {
  pending:    'bg-gray-100 text-gray-600',
  processing: 'bg-amber-100 text-amber-700',
  pr_ready:   'bg-emerald-100 text-emerald-700',
  suggestion: 'bg-indigo-100 text-indigo-700',
  rejected:   'bg-gray-100 text-gray-400',
  merged:     'bg-green-100 text-green-700',
}
const STATUS_LABELS: Record<FbStatus, string> = {
  pending: '待處理', processing: '處理中', pr_ready: 'PR 已建立',
  suggestion: '建議記錄', rejected: '已關閉', merged: '已合併',
}
const TYPE_LABELS: Record<FbType, string> = {
  bug: '🐛 錯誤', ai_error: '🤖 AI錯誤', text_change: '🎨 UI調整', feature: '✨ 新功能',
}

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading]     = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)

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

  const filtered = feedbacks.filter(f => statusFilter === 'all' || f.status === statusFilter)

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            使用者回饋管理
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">用戶送出後 AI 自動處理。你只需：① 合併 GitHub PR  ② 手動解決「建議」類複雜需求</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border hover:bg-gray-50 text-gray-500">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'processing', 'pr_ready', 'suggestion', 'merged', 'rejected'] as const).map(s => (
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

              {fb.profiles?.email && (
                <div className="text-[11px] text-gray-400">提交者：{fb.profiles.email}</div>
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
                {/* Retry: only for failed/stuck items */}
                {(fb.status === 'pending' || fb.status === 'suggestion') && (
                  <button onClick={() => process(fb.id)} disabled={processing === fb.id}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {processing === fb.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    {processing === fb.id ? 'AI 處理中…' : '重新嘗試 AI'}
                  </button>
                )}
                {fb.status === 'pr_ready' && (
                  <button onClick={() => updateStatus(fb.id, 'merged')}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />標記已合併
                  </button>
                )}
                {fb.status !== 'rejected' && fb.status !== 'merged' && (
                  <button onClick={() => updateStatus(fb.id, 'rejected')}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                    <AlertCircle className="h-3.5 w-3.5" />關閉
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
