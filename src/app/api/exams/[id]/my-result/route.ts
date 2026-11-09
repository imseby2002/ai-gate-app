/** GET /api/exams/[id]/my-result — 員工查看自己已公布的批改結果（分數、評語；答案依考卷設定） */
import { NextResponse } from 'next/server'
import { getDeptAccess } from '@/lib/company/dept-access'
import { loadExam, loadReleasedResult } from '@/lib/exams/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: access.status })
  const exam = await loadExam(access, (await params).id)
  if (!exam || exam.status === 'draft' || !exam.audience.includes('employee')) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const data = await loadReleasedResult(access.admin, exam, { user_id: access.userId })
  if (!data) return NextResponse.json({ error: 'not_released' }, { status: 404 })
  return NextResponse.json(data)
}
