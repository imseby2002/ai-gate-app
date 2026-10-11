'use client'

import { useState, useCallback, useEffect } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

type Status = 'pending' | 'active' | 'rejected' | 'revoked'

interface ManagedRequest {
  user_id: string
  status: Status
  contact: string | null
  note: string | null
  login_account: string | null
  group_name: string | null
  admin_note: string | null
  has_password: boolean
  default_group_name: string
  requested_at: string
  activated_at: string | null
  profile: { email: string | null; full_name: string | null } | null
}

const STATUS_LABEL: Record<Status, string> = { pending: '待開通', active: '已開通', rejected: '已拒絕', revoked: '已停用' }
const STATUS_COLOR: Record<Status, string> = {
  pending: 'bg-amber-100 text-amber-700',
  active: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-gray-100 text-gray-600',
  revoked: 'bg-rose-100 text-rose-700',
}

type Draft = { login_account: string; login_password: string; group_name: string; admin_note: string }

export function AdspowerManagedTable() {
  const [rows, setRows] = useState<ManagedRequest[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/adspower-managed')
      const data = await res.json()
      if (!res.ok) return
      const list: ManagedRequest[] = data.requests ?? []
      setRows(list)
      setDrafts(Object.fromEntries(list.map(r => [r.user_id, {
        login_account: r.login_account ?? '',
        login_password: '',
        group_name: r.group_name ?? r.default_group_name,
        admin_note: r.admin_note ?? '',
      }])))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const save = async (id: string, status: Status) => {
    setBusyId(id)
    try {
      const res = await fetch('/api/admin/adspower-managed', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: id, status, ...drafts[id] }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { alert(data.error ?? '儲存失敗'); return }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const input = 'w-full rounded-md border px-2 py-1 text-xs'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">{loading ? '載入中…' : `共 ${rows.length} 筆`}</div>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <RefreshCw className="h-3.5 w-3.5" /> 重新整理
        </button>
      </div>

      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left font-medium py-2.5 px-3">申請帳號</th>
              <th className="text-left font-medium py-2.5 px-3">聯絡方式／留言</th>
              <th className="text-left font-medium py-2.5 px-3">AdsPower 成員帳號</th>
              <th className="text-left font-medium py-2.5 px-3">密碼</th>
              <th className="text-left font-medium py-2.5 px-3">分組</th>
              <th className="text-left font-medium py-2.5 px-3">備註</th>
              <th className="text-center font-medium py-2.5 px-3">狀態</th>
              <th className="text-center font-medium py-2.5 px-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const d = drafts[r.user_id]
              const busy = busyId === r.user_id
              return (
                <tr key={r.user_id} className="border-t align-top">
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-gray-900">{r.profile?.full_name || '—'}</div>
                    <div className="text-xs text-gray-500">{r.profile?.email ?? r.user_id}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{new Date(r.requested_at).toLocaleString('zh-TW')}</div>
                  </td>
                  <td className="py-2.5 px-3 text-gray-600 text-xs max-w-[200px] whitespace-pre-wrap">
                    {r.contact || '—'}{r.note ? `\n${r.note}` : ''}
                  </td>
                  <td className="py-2.5 px-3 w-48">
                    <input className={input} value={d?.login_account ?? ''} onChange={e => setDraft(r.user_id, { login_account: e.target.value })} placeholder="成員登入帳號" />
                  </td>
                  <td className="py-2.5 px-3 w-40">
                    <input
                      type="password"
                      autoComplete="new-password"
                      className={input}
                      value={d?.login_password ?? ''}
                      onChange={e => setDraft(r.user_id, { login_password: e.target.value })}
                      placeholder={r.has_password ? '已設定（留空不變）' : '成員登入密碼'}
                    />
                  </td>
                  <td className="py-2.5 px-3 w-40">
                    <input className={`${input} font-mono`} value={d?.group_name ?? ''} onChange={e => setDraft(r.user_id, { group_name: e.target.value })} />
                  </td>
                  <td className="py-2.5 px-3 w-40">
                    <input className={input} value={d?.admin_note ?? ''} onChange={e => setDraft(r.user_id, { admin_note: e.target.value })} />
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`text-xs rounded-full px-2 py-1 ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col gap-1 items-stretch">
                      <button
                        onClick={() => save(r.user_id, 'active')}
                        disabled={busy}
                        className="inline-flex items-center justify-center gap-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                      >
                        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                        {r.status === 'active' ? '儲存' : '開通'}
                      </button>
                      {r.status === 'pending' && (
                        <button onClick={() => save(r.user_id, 'rejected')} disabled={busy} className="text-xs text-gray-500 hover:text-gray-800">拒絕</button>
                      )}
                      {r.status === 'active' && (
                        <button onClick={() => save(r.user_id, 'revoked')} disabled={busy} className="text-xs text-rose-600 hover:text-rose-800">停用</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-gray-400">目前沒有代管申請</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        停用後客人網頁上不再顯示登入資訊，連接器改回自備模式；請同時到 AdsPower 團隊後台移除或停用該成員，才會真正失去存取權。
      </p>
    </div>
  )
}
