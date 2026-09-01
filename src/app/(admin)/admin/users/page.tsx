import { createClient } from '@/lib/supabase/server'
import { UserManagementTable } from '@/components/admin/UserManagementTable'
import { EmployeeWhitelistManager } from '@/components/admin/EmployeeWhitelistManager'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const [
    { data: users },
    { data: userUsage },
    { data: whitelist },
    { data: companies },
  ] = await Promise.all([
    supabase.from('profiles').select('*, subscriptions(plan_id, status)').order('created_at', { ascending: false }),
    supabase.from('usage_daily').select('user_id, total_cost_usd, message_count').gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]),
    supabase.from('employee_whitelist').select('id, email, note, added_at').order('added_at', { ascending: false }),
    supabase.from('companies').select('id, name').order('name', { ascending: true }),
  ])

  const usageMap = new Map<string, { cost: number; messages: number }>()
  for (const row of userUsage ?? []) {
    const existing = usageMap.get(row.user_id) ?? { cost: 0, messages: 0 }
    existing.cost += row.total_cost_usd ?? 0
    existing.messages += row.message_count ?? 0
    usageMap.set(row.user_id, existing)
  }

  const compMap = new Map((companies ?? []).map(c => [c.id, c]))

  const usersWithUsage = (users ?? []).map(u => ({
    ...u,
    company: u.company_id ? compMap.get(u.company_id) ?? null : null,
    monthly_cost: usageMap.get(u.id)?.cost ?? 0,
    monthly_messages: usageMap.get(u.id)?.messages ?? 0,
  }))

  return (
    <div className="px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">用戶管理</h1>
        <p className="text-gray-500 text-sm mt-1">共 {users?.length ?? 0} 位用戶</p>
      </div>

      <EmployeeWhitelistManager entries={whitelist ?? []} />

      <UserManagementTable users={usersWithUsage} companies={companies ?? []} />
    </div>
  )
}
