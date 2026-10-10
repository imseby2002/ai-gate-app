/**
 * GET  /api/knowledge?department=hr — 公司知識檔案清單（全公司成員皆可讀）
 * POST /api/knowledge（multipart）— 上傳知識：department、title、file 或 text（公司負責人／IT／該部門負責人）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDeptAccess, canManageDept } from '@/lib/company/dept-access'
import { extractFileText } from '@/lib/knowledge/extract'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_CHARS = 500_000

export async function GET(req: NextRequest) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: access.status })

  let q = access.admin.from('knowledge_docs')
    .select('id, department, title, source_type, file_name, char_count, created_at, updated_at')
    .eq('company_id', access.companyId)
    .order('created_at', { ascending: false })
  const dept = req.nextUrl.searchParams.get('department')
  if (dept) q = q.eq('department', dept)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    docs: (data ?? []).map(d => ({ ...d, editable: canManageDept(access, d.department as string) })),
    isCompanyAdmin: access.isCompanyAdmin,
    managedUnits: access.isCompanyAdmin ? null : access.isManager ? access.units : [],
  })
}

export async function POST(req: NextRequest) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: access.status })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const department = String(form.get('department') ?? '').trim()
  if (!department) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  if (!canManageDept(access, department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const file = form.get('file')
  let title = String(form.get('title') ?? '').trim().slice(0, 200)
  let content = ''
  let fileName: string | null = null
  if (file && typeof file !== 'string') {
    fileName = file.name
    const text = await extractFileText(file.name, await file.arrayBuffer())
    if (text == null) return NextResponse.json({ error: 'unsupported_type' }, { status: 400 })
    content = text
    if (!title) title = file.name.replace(/\.[^.]+$/, '')
  } else {
    content = String(form.get('text') ?? '')
  }
  content = content.trim()
  if (!content || !title) return NextResponse.json({ error: 'empty' }, { status: 400 })
  const truncated = content.length > MAX_CHARS
  content = content.slice(0, MAX_CHARS)

  const { data, error } = await access.admin.from('knowledge_docs').insert({
    company_id: access.companyId,
    department,
    title,
    source_type: fileName ? 'file' : 'text',
    file_name: fileName,
    content,
    char_count: content.length,
    created_by: access.userId,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id, chars: content.length, truncated })
}
