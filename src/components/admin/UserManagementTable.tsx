'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCost } from '@/lib/utils/format'

const ALL_MODULES = [
  { id: 'chat',      label: 'AI 對話' },
  { id: 'marketing', label: '行銷自動化' },
  { id: 'cs',        label: '客服系統' },
  { id: 'leads',     label: '潛在客戶' },
  { id: 'resume',    label: '職場助手' },
  { id: 'booking',   label: '訂房系統' },
  { id: 'work',      label: '工作管理' },
  { id: 'hr',        label: '人事管理' },
  { id: 'finance',   label: '出納總務' },
] as const

type ModuleId = typeof ALL_MODULES[number]['id']

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
  enabled_modules: string[] | null
  subscriptions: Array<{ plan_id: string; status: string }> | null
}

interface Props {
  users: UserRow[]
}

export function UserManagementTable({ users }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'employee' | 'external' | 'admin'>('all')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name?.toLowerCase().includes(search.toLowerCase()))
    const matchFilter = filter === 'all' || u.user_type === filter
    return matchSearch && matchFilter
  })

  const patch = async (userId: string, body: Record<string, unknown>) => {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...body }),
    })
    router.refresh()
  }

  const handleToggleModule = async (user: UserRow, moduleId: ModuleId) => {
    const current = user.enabled_modules ?? ALL_MODULES.map(m => m.id)
    const next = current.includes(moduleId)
      ? current.filter(m => m !== moduleId)
      : [...current, moduleId]
    setSaving(user.id + moduleId)
    await patch(user.id, { enabled_modules: next })
    setSaving(null)
  }

  const handleSetModules = async (user: UserRow, next: string[]) => {
    setSaving(user.id + ':bulk')
    await patch(user.id, { enabled_modules: next })
    setSaving(null)
  }

  const TYPE_COLORS: Record<string, string> = {
    employee: 'bg-green-100 text-green-700',
    external: 'bg-blue-100 text-blue-700',
    admin:    'bg-purple-100 text-purple-700',
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
            {filtered.map(user => {
              const mods = user.enabled_modules ?? ALL_MODULES.map(m => m.id)
              const isExpanded = expandedUser === user.id
              return (
                <>
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="font-medium">{user.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-400">{user.email}</div>
                      {user.department && <div className="text-xs text-gray-400">{user.department}</div>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {user.user_type === 'admin' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">全部功能</span>
                        ) : mods.length === 0 ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">未開通功能</span>
                        ) : (
                          ALL_MODULES.filter(m => mods.includes(m.id)).map(m => (
                            <span key={m.id} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{m.label}</span>
                          ))
                        )}
                      </div>
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
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => patch(user.id, { is_active: !user.is_active })}
                          className="text-xs px-2.5 py-1 rounded-md border hover:bg-gray-100 transition-colors"
                        >
                          {user.is_active ? '停用' : '啟用'}
                        </button>
                        <select
                          value={user.user_type}
                          onChange={e => patch(user.id, { user_type: e.target.value })}
                          className="text-xs px-2 py-1 rounded-md border bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                          title="變更帳號類型"
                        >
                          <option value="external">外部</option>
                          <option value="employee">員工</option>
                          <option value="admin">管理員</option>
                        </select>
                        <button
                          onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                          className="text-xs px-2.5 py-1 rounded-md border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-1"
                        >
                          模組
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={user.id + '_modules'} className="border-b bg-indigo-50/40">
                      <td colSpan={6} className="px-5 py-3 space-y-2">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-xs text-gray-500 font-medium mr-1">快速設定：</span>
                          <button
                            onClick={() => handleSetModules(user, ALL_MODULES.map(m => m.id))}
                            disabled={saving === user.id + ':bulk'}
                            className="text-xs px-2.5 py-1 rounded-md border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 disabled:opacity-50"
                          >全選</button>
                          <button
                            onClick={() => handleSetModules(user, [])}
                            disabled={saving === user.id + ':bulk'}
                            className="text-xs px-2.5 py-1 rounded-md border border-rose-200 text-rose-700 bg-white hover:bg-rose-50 disabled:opacity-50"
                          >全不選</button>
                          <select
                            value=""
                            onChange={e => { if (e.target.value) handleSetModules(user, [e.target.value]) }}
                            disabled={saving === user.id + ':bulk'}
                            className="text-xs px-2.5 py-1 rounded-md border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 disabled:opacity-50"
                          >
                            <option value="">只給單一功能…</option>
                            {ALL_MODULES.map(m => <option key={m.id} value={m.id}>只給 {m.label}</option>)}
                          </select>
                          <button
                            onClick={() => handleSetModules(user, ['cs', 'booking'])}
                            disabled={saving === user.id + ':bulk'}
                            className="text-xs px-2.5 py-1 rounded-md border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 disabled:opacity-50"
                          >客服+訂房</button>
                          <button
                            onClick={() => handleSetModules(user, ['marketing', 'cs'])}
                            disabled={saving === user.id + ':bulk'}
                            className="text-xs px-2.5 py-1 rounded-md border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 disabled:opacity-50"
                          >行銷+客服</button>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-xs text-gray-500 font-medium mr-1">可用模組：</span>
                          {ALL_MODULES.map(m => {
                            const enabled = mods.includes(m.id)
                            const isSaving = saving === user.id + m.id
                            return (
                              <button
                                key={m.id}
                                onClick={() => handleToggleModule(user, m.id)}
                                disabled={isSaving || saving === user.id + ':bulk'}
                                className={`text-xs px-3 py-1 rounded-full border font-medium transition-all ${
                                  enabled
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-gray-400 border-gray-300'
                                } ${isSaving ? 'opacity-50' : ''}`}
                              >
                                {m.label}
                              </button>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
