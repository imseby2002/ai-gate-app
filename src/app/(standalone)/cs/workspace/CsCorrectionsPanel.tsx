'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, Undo2, ShieldCheck, ShieldOff } from 'lucide-react'

interface Correction {
  id: string
  situation: string
  wrong_reply: string
  correct_guidance: string
  status: 'active' | 'reverted'
  created_by: string
  created_at: string
  reverted_by: string | null
  reverted_at: string | null
}

export function CsCorrectionsPanel() {
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [authors, setAuthors] = useState<Record<string, string>>({})
  const [canCorrectAi, setCanCorrectAi] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [situation, setSituation] = useState('')
  const [wrongReply, setWrongReply] = useState('')
  const [correctGuidance, setCorrectGuidance] = useState('')
  const [saving, setSaving] = useState(false)
  const [revertingId, setRevertingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/marketing/cs-ai-corrections')
      const data = await res.json()
      setCorrections(data.corrections ?? [])
      setAuthors(data.authors ?? {})
      setCanCorrectAi(!!data.canCorrectAi)
      setIsOwner(!!data.isOwner)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setSituation(''); setWrongReply(''); setCorrectGuidance(''); setError(''); setCreating(false)
  }

  const submit = async () => {
    if (!situation.trim()) { setError('請描述客人問了什麼／當時的情境'); return }
    if (!wrongReply.trim()) { setError('請貼上 AI 錯誤的回覆內容'); return }
    if (!correctGuidance.trim()) { setError('請說明正確做法'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/marketing/cs-ai-corrections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation, wrongReply, correctGuidance }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '送出失敗')
      resetForm()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const revert = async (id: string) => {
    if (!confirm('確定要撤銷這筆修正？撤銷後 AI 就不會再套用這條規則。')) return
    setRevertingId(id)
    try {
      await fetch(`/api/marketing/cs-ai-corrections/${id}`, { method: 'PATCH' })
      await load()
    } finally {
      setRevertingId(null)
    }
  }

  const active = corrections.filter(c => c.status === 'active')
  const reverted = corrections.filter(c => c.status === 'reverted')

  return (
    <div className="space-y-5">
      <div className="bg-white border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">AI 回答修正</h2>
        <p className="text-xs text-gray-500 mb-4">
          發現 AI 回答錯誤、漏做事情、或卡在無限循環時，把當時的情境、AI 的錯誤回覆、正確做法貼在這裡，
          送出後立即生效，AI 之後遇到類似情境會照這條規則回答，不用每次都等擁有者處理。
        </p>

        {!canCorrectAi ? (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <ShieldOff className="h-3.5 w-3.5 shrink-0" />
            你目前沒有提交修正的權限，請擁有者到「協作成員」頁面為你開啟「可修正 AI」。
          </div>
        ) : creating ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">情境（客人問了什麼／當時發生什麼事）</label>
              <textarea value={situation} onChange={e => setSituation(e.target.value)} rows={2}
                placeholder="例如：客人已經確認訂房姓名「對對！」，AI 卻沒有繼續給密碼，一直繞圈問其他問題"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">AI 錯誤的回覆（直接貼上）</label>
              <textarea value={wrongReply} onChange={e => setWrongReply(e.target.value)} rows={3}
                placeholder="把 AI 當時實際回覆的內容貼在這裡"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">正確做法</label>
              <textarea value={correctGuidance} onChange={e => setCorrectGuidance(e.target.value)} rows={2}
                placeholder="例如：客人確認姓名後（不管用什麼字回覆「是」），下一則回覆就要直接照系統資料給密碼，不能再問其他問題"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none" />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button onClick={submit} disabled={saving}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}送出，立即生效
              </button>
              <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg">取消</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="h-4 w-4" />回報一筆修正
          </button>
        )}
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">生效中的修正（{active.length}）</h2>
        {loading ? (
          <div className="text-sm text-gray-400 py-6 text-center">載入中…</div>
        ) : active.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">目前沒有生效中的修正紀錄</div>
        ) : (
          <div className="divide-y">
            {active.map(c => (
              <div key={c.id} className="py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-900 flex-1">{c.situation}</p>
                  {isOwner && (
                    <button onClick={() => revert(c.id)} disabled={revertingId === c.id}
                      className="shrink-0 flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50">
                      {revertingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}撤銷
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400">錯誤回覆：{c.wrong_reply}</p>
                <p className="text-xs text-emerald-600">正確做法：{c.correct_guidance}</p>
                <p className="text-[11px] text-gray-300">
                  {authors[c.created_by] ?? '未知'} · {new Date(c.created_at).toLocaleString('zh-TW')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {reverted.length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">已撤銷（{reverted.length}）</h2>
          <div className="divide-y opacity-60">
            {reverted.map(c => (
              <div key={c.id} className="py-3 space-y-1">
                <p className="text-sm text-gray-500 line-through">{c.situation}</p>
                <p className="text-[11px] text-gray-300">
                  由 {authors[c.reverted_by ?? ''] ?? '未知'} 於 {c.reverted_at ? new Date(c.reverted_at).toLocaleString('zh-TW') : ''} 撤銷
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
