import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function AdminAgentsPage() {
  const supabase = await createClient()

  const [{ data: runs }, { data: pendingApprovals }, { data: enabledRoles }] = await Promise.all([
    supabase.from('agent_runs').select('id, status, total_credits_spent, created_at').order('created_at', { ascending: false }).limit(200),
    supabase.from('agent_approvals').select('id, action_type, risk_level, requested_at, user_id').in('status', ['pending', 'awaiting_feedback']).order('requested_at', { ascending: false }),
    supabase.from('user_agent_roles').select('id, role_id, user_id').eq('enabled', true),
  ])

  const statusCounts: Record<string, number> = {}
  let totalSpent = 0
  for (const r of runs ?? []) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
    totalSpent += Number(r.total_credits_spent ?? 0)
  }

  return (
    <div className="px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agent 管理總覽</h1>
        <p className="text-gray-500 text-sm mt-1">
          全站 Agent 執行狀態、待核准佇列與已啟用角色數。
          <Link href="/admin/agents/roles" className="text-indigo-600 hover:underline ml-2">管理角色 →</Link>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">近 200 筆花費</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">${totalSpent.toFixed(4)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">待核准</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{pendingApprovals?.length ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">已啟用角色數</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{enabledRoles?.length ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">執行中</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{statusCounts.running ?? 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Run 狀態分佈</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(statusCounts).length === 0 && <p className="text-sm text-muted-foreground">尚無執行紀錄。</p>}
          {Object.entries(statusCounts).map(([status, count]) => (
            <Badge key={status} variant="secondary">{status}：{count}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">待核准佇列</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(pendingApprovals ?? []).length === 0 && <p className="text-sm text-muted-foreground">目前沒有待核准的項目。</p>}
          {(pendingApprovals ?? []).map(a => (
            <div key={a.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
              <span>{a.action_type}</span>
              <Badge variant={a.risk_level === 'high' ? 'destructive' : a.risk_level === 'medium' ? 'warning' : 'secondary'}>{a.risk_level}</Badge>
              <span className="text-muted-foreground text-xs">{new Date(a.requested_at).toLocaleString('zh-TW')}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
