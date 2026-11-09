/** GET — 員工專區查看自己已公布的批改結果（分數、評語；答案依考卷設定） */
import { NextRequest, NextResponse } from 'next/server'
import { portalEmployee } from '../../../_auth'
import { EXAM_COLUMNS, loadReleasedResult, type ExamRow } from '@/lib/exams/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ no: string; id: string }> }) {
  const { no, id } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await ctx.admin.from('exams').select(EXAM_COLUMNS).eq('id', id).eq('company_id', ctx.company.companyId).maybeSingle()
  const exam = data as ExamRow | null
  if (!exam || exam.status === 'draft' || !exam.audience.includes('employee')) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const out = await loadReleasedResult(ctx.admin, exam, { hr_employee_id: ctx.emp.id })
  if (!out) return NextResponse.json({ error: 'not_released' }, { status: 404 })
  return NextResponse.json(out)
}
