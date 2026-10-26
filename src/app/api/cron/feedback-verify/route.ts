/**
 * GET /api/cron/feedback-verify（每 6 小時）
 * 對未結案的意見反映做 AI 驗收：若已有合併的程式修改完成需求，改為「待確認」交給管理者確認。
 * 同一案 24 小時內最多檢查一次，每輪最多 8 案。
 */
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/cron/auth'
import { verifyFeedbackCompletion } from '@/lib/feedback/verify'

const OPEN_STATUSES = ['pending', 'suggestion', 'approved', 'in_progress']

export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError
  if (!process.env.GITHUB_PAT) return NextResponse.json({ skipped: 'no GITHUB_PAT' })

  const admin = createAdminClient()
  const { data: rows } = await admin.from('user_feedback').select('id, ai_verdict')
    .in('status', OPEN_STATUSES).order('updated_at', { ascending: true }).limit(100)
  const dayAgo = Date.now() - 24 * 3600 * 1000
  const due = (rows ?? []).filter(r => {
    const at = (r.ai_verdict as { checked_at?: string } | null)?.checked_at
    return !at || new Date(at).getTime() < dayAgo
  }).slice(0, 8)

  const results: Array<{ id: string; done?: boolean; error?: string }> = []
  for (const r of due) {
    const res = await verifyFeedbackCompletion(r.id)
    results.push(res.ok ? { id: r.id, done: res.verdict.done } : { id: r.id, error: res.error })
  }
  return NextResponse.json({ checked: results.length, results })
}
