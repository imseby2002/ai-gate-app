'use client'
import { useState, useEffect } from 'react'
import { MessageSquarePlus, CheckCircle2, Clock, GitBranch, AlertCircle, ExternalLink, Loader2, RefreshCw } from 'lucide-react'

type FbType = 'bug' | 'feature' | 'text_change' | 'ai_error'
type FbStatus = 'pending' | 'processing' | 'pr_ready' | 'suggestion' | 'rejected' | 'merged'

interface Feedback {
  id: string; title: string; description: string; type: FbType; status: FbStatus
  complexity: string | null; ai_plan: string | null; branch_name: string | null
  pr_url: string | null; preview_url: string | null; admin_notes: string | null
  error_log: string | null; created_at: string
}

const TYPE_LABELS: Record<FbType, { label: string; desc: string; color: string }> = {
  bug:         { label: '錯誤回報', desc: '功能異常、計算錯誤', color: 'bg-red-100 text-red-700 border-red-200' },
  ai_error:    { label: 'AI 回應錯誤', desc: '金額錯誤、資訊不準確', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  text_change: { label: 'UI / 文字調整', desc: '顏色、版面、措辭', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  feature:     { label: '新功能需求', desc: '新頁面、新功能', color: 'bg-purple-100 text-purple-700 border-purple-200' },
}

const STATUS_CONFIG: Record<FbStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:    { label: '待處理', color: 'text-gray-500', icon: <Clock className="h-3.5 w-3.5" /> },
  processing: { label: 'AI 處理中', color: 'text-amber-600', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  pr_ready:   { label: '已產生分支，待測試', color: 'text-emerald-600', icon: <GitBranch className="h-3.5 w-3.5" /> },
  suggestion: { label: '已記錄為建議', color: 'text-indigo-600', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected:   { label: '已關閉', color: 'text-gray-400', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  merged:     { label: '已合併上線', color: 'text-green-600', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
}

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks]   = useState<Feedback[]>([])
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [form, setForm] = useState({ title: '', description: '', type: 'bug' as FbType })

  useEffect(() => { loadFeedbacks() }, [])

  async function loadFeedbacks() {
    setLoading(true)
    const r = await fetch('/api/feedback').then(r => r.json()).catch(() => ({ feedbacks: [] }))
    setFeedbacks(r.feedbacks ?? [])
    setLoading(false)
  }

  async function submit() {
    if (!form.title.trim() || !form.description.trim()) return
    setSubmitting(true)
    try {
      const r = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (d.feedback) {
        setFeedbacks(prev => [d.feedback, ...prev])
        setForm({ title: '', description: '', type: 'bug' })
        setSubmitted(true)
        setTimeout(() => setSubmitted(false), 4000)
      }
    } finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-16">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquarePlus className="h-5 w-5 text-indigo-600" />
          意見回饋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          回報問題或提出建議，AI 會自動嘗試修復並建立測試分支給你試用
        </p>
      </div>

      {/* Submit form */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-sm text-gray-800">提交新回饋</h2>

        {/* Type selector */}
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(TYPE_LABELS) as [FbType, typeof TYPE_LABELS[FbType]][]).map(([key, cfg]) => (
            <button key={key} onClick={() => setForm(f => ({ ...f, type: key }))}
              className={`border rounded-xl p-3 text-left transition-all ${form.type === key ? cfg.color + ' border-current' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="text-xs font-bold">{cfg.label}</div>
              <div className="text-[11px] opacity-70 mt-0.5">{cfg.desc}</div>
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">標題（簡短描述）</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="例：訂房計算機的假日價格算錯"
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">詳細描述</label>
          <textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="請描述問題的具體情況、預期應該怎樣、實際發生什麼。AI 需要充分資訊才能正確修復。"
            className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>

        {submitted && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            已提交！管理者會在處理後通知你測試連結。
          </div>
        )}

        <button onClick={submit} disabled={submitting || !form.title.trim() || !form.description.trim()}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />提交中…</> : '提交回饋'}
        </button>
      </div>

      {/* My feedbacks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">我的回饋記錄</span>
          <button onClick={loadFeedbacks} className="text-gray-400 hover:text-gray-600">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400 border rounded-xl">尚無回饋記錄</div>
        ) : (
          feedbacks.map(fb => {
            const sc = STATUS_CONFIG[fb.status]
            const tc = TYPE_LABELS[fb.type]
            return (
              <div key={fb.id} className="bg-white border rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${tc.color}`}>{tc.label}</span>
                  <div className={`flex items-center gap-1 text-[11px] font-medium ${sc.color}`}>
                    {sc.icon}{sc.label}
                  </div>
                  <span className="text-[10px] text-gray-400 ml-auto">{new Date(fb.created_at).toLocaleString('zh-TW')}</span>
                </div>

                <div className="text-sm font-semibold text-gray-900">{fb.title}</div>
                <div className="text-xs text-gray-500 line-clamp-2">{fb.description}</div>

                {fb.ai_plan && (
                  <div className="text-[11px] text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">
                    🤖 {fb.ai_plan}
                  </div>
                )}

                {fb.admin_notes && (
                  <div className="text-[11px] text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    💬 管理者：{fb.admin_notes}
                  </div>
                )}

                {fb.status === 'pr_ready' && (
                  <div className="flex flex-wrap gap-2">
                    {fb.preview_url && (
                      <a href={fb.preview_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                        <ExternalLink className="h-3.5 w-3.5" />
                        點此測試新版本
                      </a>
                    )}
                    {fb.pr_url && (
                      <a href={fb.pr_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                        <GitBranch className="h-3.5 w-3.5" />
                        GitHub PR
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
