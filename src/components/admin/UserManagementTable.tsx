'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Shield, User, DollarSign } from 'lucide-react'
import { formatCost, formatDateTime } from '@/lib/utils/format'

interface UserRow {
  id: string
  email: string
  full_name: string | null
  user_type: string
  is_active: boolean
  department: string | null
  created_at: string
  monthly_cost: number
  monthly_messages: number
  subscriptions: Array<{ plan_id: string; status: string }> | null
}

interface Props {
  users: UserRow[]
}

export function UserManagementTable({ users }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'employee' | 'external' | 'admin'>('all')

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name?.toLowerCase().includes(search.toLowerCase()))
    const matchFilter = filter === 'all' || u.user_type === filter
    return matchSearch && matchFilter
  })

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, is_active: !isActive }),
    })
    router.refresh()
  }

  const handleChangeType = async (userId: string, userType: string) => {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, user_type: userType }),
    })
    router.refresh()
  }

  const TYPE_COLORS: Record<string, string> = {
    employee: 'bg-green-100 text-green-700',
    external: 'bg-blue-100 text-blue-700',
    admin: 'bg-purple-100 text-purple-700',
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      {/* Filters */}
      <div className="p-5 border-b flex flex-wrap items-center gap-4">
        <div className="flex-1 relative min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜尋用戶..."
            className="w-full pl-9 pr-3 h-9 rounded-lg border text-sm outline-none focus:ring-2"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'employee', 'external', 'admin'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
              style={filter === f ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' } : {}}
            >
              {f === 'all' ? '全部' : f === 'employee' ? '員工' : f === 'external' ? '外部' : '管理員'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-500">用戶</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">類型</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">本月費用</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">本月對話</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">狀態</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(user => (
              <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="font-medium">{user.full_name ?? '—'}</div>
                  <div className="text-xs text-gray-400">{user.email}</div>
                  {user.department && <div className="text-xs text-gray-400">{user.department}</div>}
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[user.user_type]}`}>
                    {user.user_type === 'employee' ? '員工' : user.user_type === 'admin' ? '管理員' : '外部'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-medium">{formatCost(user.monthly_cost)}</td>
                <td className="px-5 py-3 text-right">{user.monthly_messages}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {user.is_active ? '正常' : '停用'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleActive(user.id, user.is_active)}
                      className="text-xs px-2.5 py-1 rounded-md border hover:bg-gray-100 transition-colors"
                    >
                      {user.is_active ? '停用' : '啟用'}
                    </button>
                    {user.user_type !== 'admin' && (
                      <button
                        onClick={() => handleChangeType(user.id, 'admin')}
                        className="text-xs px-2.5 py-1 rounded-md border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors"
                      >
                        設為管理員
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
