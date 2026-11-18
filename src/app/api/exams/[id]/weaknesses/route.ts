/** GET /api/exams/[id]/weaknesses — 取得指定考卷作答錯題與弱點分析 */
import { NextRequest, NextResponse } from 'next/server'
import { getDeptAccess, canManageDept } from '@/lib/company/dept-access'
import { loadExam } from '@/lib/exams/server'
import { analyzeExamWeaknesses } from '@/lib/exams/weakness'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })
  const exam = await loadExam(access, (await params).id)
  if (!exam) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canManageDept(access, exam.department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const summary = await analyzeExamWeaknesses(access.admin, exam.id)
  if (!summary) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json(summary)
}