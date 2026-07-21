'use client'

import { useState, useCallback, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

interface SupportRequest {
  id: string
  owner_id: string
  user_id: string
  type: 'feature' | 'feedback'
  contact: string | null
  note: string
  plan_at_request: string | null
  price_usd: number | null
  status: 'pending' | 'contacted' | 'done'
  created_at: string
  owner: { email: string | null; full_name: string | null } | null
}

const STATUS_LABEL: Record<string, string> = { pending: '待處理', contacted: '已聯繫', done: '已完成' }
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  contacted: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
}
const TYPE_LABEL: Record<string, string> = { feature: '客製功能', feedback: '問題反映' }
const TYPE_COLOR: Record<string, string> = {
  feature: 'bg-violet-100 text-violet-700',
  feedback: 'bg-sky-100 text-sky-700',
}

export function CsSupportRequestsTable() {
  const [rows, setRows] = useState<SupportRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'feature' | 'feedback'>('all')

  const load = useCallback(async (t: typeof filter) => {
    setLoading(true)
    try {
      const qs = t === 'all' ? '' : `?type=${t}`
      const res = await fetch(`/api/admin/cs-support-requests${qs}`)
      const data = await res.json()
      if (res.ok) setRows(data.requests ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(filter) }, [load, filter])

  const setStatus = async (id: string, status: string) => {
    setBusyId(id)
    try {
      const res = await fetch('/api/admin/cs-support-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) setRows(prev => prev.map(r => r.id === id ? { ...r, status: status as SupportRequest['status'] } : r))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 text-xs">
          {(['all', 'feature', 'feedback'] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-2.5 py-1 rounded-lg ${filter === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {t === 'all' ? '全部' : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <button onClick={() => load(filter)} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <RefreshCw className="h-3.5 w-3.5" /> 重新整理
        </button>
      </div>

      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left font-medium py-2.5 px-3">申請帳號</th>
              <th className="text-center font-medium py-2.5 px-3">類型</th>
              <th className="text-left font-medium py-2.5 px-3">聯絡方式</th>
              <th className="text-left font-medium py-2.5 px-3">內容</th>
              <th className="text-center font-medium py-2.5 px-3">方案／參考價</th>
              <th className="text-left font-medium py-2.5 px-3">送出時間</th>
              <th className="text-center font-medium py-2.5 px-3">狀態</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t align-top">
                <td className="py-2.5 px-3">
                  <div className="font-medium text-gray-900">{r.owner?.full_name || '—'}</div>
                  <div className="text-xs text-gray-500">{r.owner?.email ?? r.owner_id}</div>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[r.type]}`}>{TYPE_LABEL[r.type]}</span>
                </td>
                <td className="py-2.5 px-3 text-gray-600 whitespace-pre-wrap">{r.contact || '—'}</td>
                <td className="py-2.5 px-3 text-gray-600 max-w-[280px] whitespace-pre-wrap">{r.note}</td>
                <td className="py-2.5 px-3 text-center text-xs text-gray-600">
                  {r.plan_at_request?.toUpperCase() ?? '—'}
                  {r.price_usd != null && <div className="text-gray-400">${r.price_usd}/次</div>}
                </td>
                <td className="py-2.5 px-3 text-gray-500 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString('zh-TW')}</td>
                <td className="py-2.5 px-3 text-center">
                  <select
                    value={r.status}
                    disabled={busyId === r.id}
                    onChange={e => setStatus(r.id, e.target.value)}
                    className={`text-xs rounded-full px-2 py-1 border-0 cursor-pointer ${STATUS_COLOR[r.status]}`}
                  >
                    {Object.entries(STATUS_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">目前沒有請求</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
