/**
 * GET  /api/knowledge?department=hr — 公司知識檔案清單（全公司成員皆可讀）
 * POST /api/knowledge — 上傳知識（公司負責人／IT／該部門負責人）
 *   JSON：department、title、storagePath + fileName（先經 /api/knowledge/upload-url 直傳 Storage，避開 Vercel 4.5MB 請求上限）或 text
 *   multipart：department、title、file 或 text（舊版相容）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDeptAccess, canManageDept } from '@/lib/company/dept-access'
import { extractFileText } from '@/lib/knowledge/extract'
import { KNOWLEDGE_BUCKET } from '@/lib/knowledge/constants'

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

  const isJson = (req.headers.get('content-type') ?? '').includes('application/json')
  const body = isJson
    ? await req.json().catch(() => null) as Record<string, unknown> | null
    : await req.formData().then(f => Object.fromEntries(f.entries()) as Record<string, unknown>).catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const department = String(body.department ?? '').trim()
  if (!department) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  if (!canManageDept(access, department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let title = String(body.title ?? '').trim().slice(0, 200)
  let content = ''
  let fileName: string | null = null
  let fileData: ArrayBuffer | null = null
  const storagePath = typeof body.storagePath === 'string' ? body.storagePath : ''
  const file = body.file
  if (storagePath) {
    if (!storagePath.startsWith(`${access.companyId}/`)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    fileName = String(body.fileName ?? '').trim() || storagePath.split('/').pop()!
    const { data: blob, error: dlErr } = await access.admin.storage.from(KNOWLEDGE_BUCKET).download(storagePath)
    await access.admin.storage.from(KNOWLEDGE_BUCKET).remove([storagePath])
    if (dlErr || !blob) {
      console.error('[knowledge] download failed', dlErr)
      return NextResponse.json({ error: 'upload_missing' }, { status: 400 })
    }
    fileData = await blob.arrayBuffer()
  } else if (file && typeof file !== 'string') {
    fileName = (file as File).name
    fileData = await (file as File).arrayBuffer()
  } else {
    content = String(body.text ?? '')
  }
  if (fileName && fileData) {
    let text: string | null
    try {
      text = await extractFileText(fileName, fileData)
    } catch (e) {
      console.error('[knowledge] extract failed', fileName, e)
      return NextResponse.json({ error: 'extract_failed' }, { status: 400 })
    }
    if (text == null) return NextResponse.json({ error: 'unsupported_type' }, { status: 400 })
    content = text
    if (!title) title = fileName.replace(/\.[^.]+$/, '')
  }
  // Postgres text 不接受 NUL 字元
  content = content.replace(/\u0000/g, '')
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
  if (error) {
    console.error('[knowledge] insert failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, chars: content.length, truncated })
}
