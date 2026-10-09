import { NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'
import type { AuditKnowledgeLog } from '@/lib/types/audit-platform'

// 稽核平台「稽核日誌」：顯示稽核討論 AI「存入稽核日誌」產生的真實紀錄（audit_logs，依公司隔離）
export async function GET() {
  const ctx = await getUnitContextAny(['audit', 'store', 'rd'])
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })

  const { data, error } = await ctx.admin.from('audit_logs')
    .select('id, store, title, summary, upto_count, created_at')
    .eq('owner_id', ctx.ownerId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const logs: AuditKnowledgeLog[] = (data ?? []).map(l => ({
    id: l.id,
    date: String(l.created_at).slice(0, 10),
    auditor_name: '稽核討論 AI',
    issue_title: l.title || '（未命名）',
    store: l.store || '—',
    chat_count: l.upto_count ?? 0,
    findings: l.summary ?? '',
    solution_adopted: '',
    status: 'approved',
    created_at: l.created_at,
  }))

  return NextResponse.json({ success: true, count: logs.length, logs })
}
