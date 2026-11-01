import { NextRequest, NextResponse } from 'next/server'
import { portalEmployee } from '../_auth'

export const dynamic = 'force-dynamic'

// 員工專區「我的考試」：公司已發布且開放員工作答的考卷，附自己最近一次成績
export async function GET(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: exams, error } = await ctx.admin.from('exams')
    .select('id, department, title, description, pass_score, audience, updated_at')
    .eq('company_id', ctx.company.companyId).eq('status', 'published').contains('audience', ['employee'])
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const ids = (exams ?? []).map(e => e.id as string)
  if (!ids.length) return NextResponse.json({ exams: [] })

  const [{ data: qs, error: qErr }, { data: mine, error: mErr }] = await Promise.all([
    ctx.admin.from('exam_questions').select('exam_id').in('exam_id', ids),
    ctx.admin.from('exam_submissions').select('exam_id, score, max_score, grading_status, created_at')
      .in('exam_id', ids).eq('hr_employee_id', ctx.emp.id).order('created_at', { ascending: false }),
  ])
  if (qErr || mErr) return NextResponse.json({ error: (qErr ?? mErr)!.message }, { status: 500 })

  return NextResponse.json({
    exams: (exams ?? []).map(e => ({
      id: e.id, department: e.department, title: e.title, description: e.description, pass_score: e.pass_score,
      question_count: (qs ?? []).filter(q => q.exam_id === e.id).length,
      my_last: (mine ?? []).find(m => m.exam_id === e.id) ?? null,
    })).filter(e => e.question_count > 0),
  })
}
