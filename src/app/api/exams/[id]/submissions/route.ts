/** GET /api/exams/[id]/submissions — 作答紀錄（僅可管理者） */
import { NextRequest, NextResponse } from 'next/server'
import { getDeptAccess, canManageDept } from '@/lib/company/dept-access'
import { loadExam } from '@/lib/exams/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })
  const exam = await loadExam(access, (await params).id)
  if (!exam) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canManageDept(access, exam.department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await access.admin.from('exam_submissions')
    .select('id, kind, user_id, taker_name, taker_contact, lang, answers, results, score, max_score, grading_status, created_at')
    .eq('exam_id', exam.id).order('created_at', { ascending: false }).limit(1000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submissions: data ?? [] })
}
