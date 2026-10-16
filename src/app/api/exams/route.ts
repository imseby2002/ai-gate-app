/**
 * GET  /api/exams — 考卷清單：可管理的考卷（含草稿）＋開放給員工作答的已發布考卷
 * POST /api/exams — 建立考卷草稿（公司負責人／IT／該部門負責人）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDeptAccess, canManageDept } from '@/lib/company/dept-access'
import { EXAM_COLUMNS, parseExamMeta, type ExamRow } from '@/lib/exams/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: access.status })

  const { data, error } = await access.admin.from('exams').select(EXAM_COLUMNS)
    .eq('company_id', access.companyId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data ?? []) as ExamRow[]

  const ids = rows.map(r => r.id)
  const [{ data: qs }, { data: subs }, { data: mine }] = await Promise.all([
    ids.length ? access.admin.from('exam_questions').select('exam_id').in('exam_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? access.admin.from('exam_submissions').select('exam_id').in('exam_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? access.admin.from('exam_submissions').select('exam_id, score, max_score, grading_status, created_at')
      .in('exam_id', ids).eq('user_id', access.userId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ])
  const count = (list: { exam_id: string }[] | null, id: string) => (list ?? []).filter(x => x.exam_id === id).length

  const exams = rows
    .map(r => {
      const editable = canManageDept(access, r.department)
      const last = (mine ?? []).find(m => m.exam_id === r.id)
      return {
        ...r,
        public_token: editable ? r.public_token : null,
        editable,
        question_count: count(qs as { exam_id: string }[] | null, r.id),
        submission_count: editable ? count(subs as { exam_id: string }[] | null, r.id) : undefined,
        my_last: last ?? null,
      }
    })
    // 不能管理的人只看得到開放員工作答的已發布考卷
    .filter(e => e.editable || (e.status === 'published' && e.audience.includes('employee')))

  return NextResponse.json({
    exams,
    isCompanyAdmin: access.isCompanyAdmin,
    managedUnits: access.isCompanyAdmin ? null : access.isManager ? access.units : [],
  })
}

export async function POST(req: NextRequest) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: access.status })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const department = typeof body?.department === 'string' ? body.department : ''
  if (!department || !body) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  if (!canManageDept(access, department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const meta = parseExamMeta(body)
  const title = meta.title as Record<string, string> | undefined
  if (!title || !(title.zh || title.en || title.vi)) return NextResponse.json({ error: 'title_required' }, { status: 400 })

  const { data, error } = await access.admin.from('exams').insert({
    company_id: access.companyId,
    department,
    ...meta,
    status: 'draft',
    created_by: access.userId,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
