import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'
import { INITIAL_KNOWLEDGE_LOGS } from '@/lib/audit/platform-core'
import type { AuditKnowledgeLog } from '@/lib/types/audit-platform'

export async function GET() {
  try {
    const ctx = await getUnitContextAny(['audit', 'store', 'rd']).catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    let logs: AuditKnowledgeLog[] = INITIAL_KNOWLEDGE_LOGS

    if (supabase) {
      try {
        const { data: dbLogs, error } = await supabase.from('audit_knowledge_logs').select('*').order('date', { ascending: false })
        if (!error && dbLogs && dbLogs.length > 0) {
          logs = dbLogs
        }
      } catch (err) {
        console.warn('Fallback to seeded knowledge logs:', err)
      }
    }

    return NextResponse.json({
      success: true,
      count: logs.length,
      logs,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch audit logs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      auditor_name = '現場稽核員',
      issue_title,
      store = '胡志明一號旗艦店',
      chat_count = 1,
      findings = '',
      solution_adopted = '',
      related_rule_code = '',
      status = 'pending_approval',
    } = body

    if (!issue_title) {
      return NextResponse.json({ error: '問題主旨為必填' }, { status: 400 })
    }

    const ctx = await getUnitContextAny(['audit', 'store', 'rd']).catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    const newLog: AuditKnowledgeLog = {
      id: `log-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      auditor_name,
      issue_title,
      store,
      chat_count: Number(chat_count) || 1,
      findings,
      solution_adopted,
      related_rule_code,
      status,
      created_at: new Date().toISOString(),
    }

    if (supabase) {
      try {
        await supabase.from('audit_knowledge_logs').insert(newLog)
      } catch (err) {
        console.warn('Persist log to DB fallback to session:', err)
      }
    }

    return NextResponse.json({
      success: true,
      log: newLog,
      message: '稽核知識日誌已記錄！',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create audit log' }, { status: 500 })
  }
}
