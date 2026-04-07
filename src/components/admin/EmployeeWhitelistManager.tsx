'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Mail, Loader2 } from 'lucide-react'

interface WhitelistEntry {
  id: string
  email: string
  note: string | null
  added_at: string
}

interface Props {
  entries: WhitelistEntry[]
}

export function EmployeeWhitelistManager({ entries }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setAdding(true)
    setError('')

    const res = await fetch('/api/admin/employee-whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), note: note.trim() || null }),
    })

    if (res.ok) {
      setEmail('')
      setNote('')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error === 'Email already in whitelist' ? '此 Email 已在名單中' : data.error)
    }
    setAdding(false)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await fetch('/api/admin/employee-whitelist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    router.refresh()
    setDeletingId(null)
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="p-5 border-b">
        <h2 className="font-semibold text-gray-900">員工 Email 白名單</h2>
        <p className="text-xs text-gray-500 mt-0.5">只有在名單中的 Email 才能以「員工」身分註冊，其他人只能以「外部用戶」身分加入。</p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="p-5 border-b bg-gray-50 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">員工 Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="employee@company.com"
              required
              className="w-full pl-9 pr-3 h-9 rounded-lg border text-sm outline-none focus:ring-2"
            />
          </div>
        </div>
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium text-gray-600 mb-1">備註（選填）</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="例如：業務部 - 張小明"
            className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2"
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="h-9 px-4 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 disabled:opacity-60"
          style={{ background: 'var(--primary)' }}
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          新增
        </button>
        {error && <p className="w-full text-xs text-red-600">{error}</p>}
      </form>

      {/* List */}
      <div>
        {entries.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            尚無員工白名單，請新增允許的員工 Email
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-5 py-2.5 font-medium text-gray-500">Email</th>
                <th className="text-left px-5 py-2.5 font-medium text-gray-500">備註</th>
                <th className="text-left px-5 py-2.5 font-medium text-gray-500">新增時間</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{entry.email}</td>
                  <td className="px-5 py-3 text-gray-500">{entry.note ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(entry.added_at).toLocaleDateString('zh-TW')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                      title="移除"
                    >
                      {deletingId === entry.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
