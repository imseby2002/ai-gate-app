'use client'

import { useState, useCallback, useEffect } from 'react'
import { Loader2, RefreshCw, ExternalLink } from 'lucide-react'

interface SetupRequest {
  id: string
  owner_id: string
  user_id: string
  industry: string
  contact: string | null
  note: string | null
  status: 'pending' | 'contacted' | 'done'
  is_free: boolean | null
  created_at: string
  owner: { email: string | null; full_name: string | null } | null
}

const STATUS_LABEL: Record<string, string> = { pending: '待處理', contacted: '已聯繫', done: '已完成' }
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  contacted: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
}

export function CsSetupRequestsTable() {
  const [rows, setRows] = useState<SetupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/cs-setup-requests')
      const data = await res.json()
      if (res.ok) setRows(data.requests ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const setStatus = async (id: string, status: string) => {
    setBusyId(id)
    try {
      const res = await fetch('/api/admin/cs-setup-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) setRows(prev => prev.map(r => r.id === id ? { ...r, status: status as SetupRequest['status'] } : r))
    } finally {
      setBusyId(null)
    }
  }

  // 一鍵代操：切換 active bnb 到該客戶，並開新分頁進客服工作台
  const impersonate = async (ownerId: string, id: string) => {
    setImpersonatingId(id)
    try {
      const res = await fetch('/api/booking/active-bnb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId }),
      })
      if (!res.ok) { const d = await res.json(); alert(d.error ?? '切換失敗'); return }
      // 標記已聯繫（開始處理）
      if (rows.find(r => r.id === id)?.status === 'pending') void setStatus(id, 'contacted')
      window.open('/cs/workspace', '_blank')
    } finally {
      setImpersonatingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">{loading ? '載入中…' : `共 ${rows.length} 筆`}</div>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <RefreshCw className="h-3.5 w-3.5" /> 重新整理
        </button>
      </div>

      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left font-medium py-2.5 px-3">申請帳號</th>
              <th className="text-left font-medium py-2.5 px-3">產業</th>
              <th className="text-left font-medium py-2.5 px-3">聯絡方式</th>
              <th className="text-left font-medium py-2.5 px-3">留言</th>
              <th className="text-center font-medium py-2.5 px-3">計費</th>
              <th className="text-left font-medium py-2.5 px-3">送出時間</th>
              <th className="text-center font-medium py-2.5 px-3">狀態</th>
              <th className="text-center font-medium py-2.5 px-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t align-top">
                <td className="py-2.5 px-3">
                  <div className="font-medium text-gray-900">{r.owner?.full_name || '—'}</div>
                  <div className="text-xs text-gray-500">{r.owner?.email ?? r.owner_id}</div>
                </td>
                <td className="py-2.5 px-3 text-gray-600">{r.industry}</td>
                <td className="py-2.5 px-3 text-gray-600 whitespace-pre-wrap">{r.contact || '—'}</td>
                <td className="py-2.5 px-3 text-gray-600 max-w-[220px] whitespace-pre-wrap">{r.note || '—'}</td>
                <td className="py-2.5 px-3 text-center">
                  {r.is_free ? <span className="text-emerald-600 text-xs">免費</span> : <span className="text-gray-500 text-xs">收費</span>}
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
                <td className="py-2.5 px-3 text-center">
                  <button
                    onClick={() => impersonate(r.owner_id, r.id)}
                    disabled={impersonatingId === r.id}
                    className="inline-flex items-center gap-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                  >
                    {impersonatingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                    代客戶設定
                  </button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-gray-400">目前沒有協助設定請求</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        「代客戶設定」會把你的操作身分切換成該客戶並開新分頁進入客服工作台，你在裡面所有設定都會存到客戶帳號。
        設定完成後，到訂房系統左上角的民宿切換器切回自己的帳號（或清除切換）即可結束代操。
      </p>
    </div>
  )
}
