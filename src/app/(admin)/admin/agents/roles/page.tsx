import { createClient } from '@/lib/supabase/server'
import { AgentRolesAdminTable } from '@/components/admin/AgentRolesAdminTable'

export default async function AdminAgentRolesPage() {
  const supabase = await createClient()
  const { data: roles } = await supabase.from('agent_roles').select('*').order('sort')

  return (
    <div className="px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agent 角色管理</h1>
        <p className="text-gray-500 text-sm mt-1">全站層級的角色開關（緊急煞車用）；使用者是否啟用某角色由使用者自己在 /agent 設定。</p>
      </div>
      <AgentRolesAdminTable roles={roles ?? []} />
    </div>
  )
}
