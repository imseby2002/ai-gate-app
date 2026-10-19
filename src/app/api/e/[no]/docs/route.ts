import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { portalEmployee } from '../_auth'
import { APPLY_BUCKET, DOC_CATALOG, DOC_LABEL, DOC_TYPE_SET } from '@/lib/hr/apply'
import { EDU, UPLOAD_REQ } from '@/lib/hr/doc-reminders'
import { candidateForEmployee } from '@/lib/hr/profile'

type Ctx = { params: Promise<{ no: string }> }
type Portal = NonNullable<Awaited<ReturnType<typeof portalEmployee>>>
const MAX_SIZE = 10 * 1024 * 1024
const DELETE_WINDOW_MS = 24 * 3600_000 // 員工只能刪除 24 小時內自己上傳的檔案
const REQUIRED = new Set([...UPLOAD_REQ.map(d => d.type), ...EDU])

const candidateOf = ({ admin, company, emp }: Portal, create: boolean) => candidateForEmployee(admin, company.ownerId, emp, create)

// 文件清單：每種文件的已上傳檔案、是否必備、人事是否已收紙本。?file=<id> 取得檔案連結
export async function GET(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const cid = await candidateOf(ctx, false)
  const fileId = req.nextUrl.searchParams.get('file')
  if (fileId) {
    if (!cid) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const { data: d } = await ctx.admin.from('hr_candidate_documents').select('storage_path').eq('id', fileId).eq('candidate_id', cid).maybeSingle()
    if (!d) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const { data: s } = await ctx.admin.storage.from(APPLY_BUCKET).createSignedUrl(d.storage_path, 300)
    if (!s?.signedUrl) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.redirect(s.signedUrl)
  }
  const [{ data: docs }, { data: checklist }] = cid
    ? await Promise.all([
      ctx.admin.from('hr_candidate_documents').select('id, doc_type, file_name, uploaded_at').eq('candidate_id', cid).order('uploaded_at'),
      ctx.admin.from('hr_candidate_checklist').select('doc_key, original_received, copy_received').eq('candidate_id', cid),
    ])
    : [{ data: [] }, { data: [] }]
  const paper = new Set((checklist ?? []).filter(c => c.original_received || c.copy_received).map(c => c.doc_key))
  const now = Date.now()
  const items = DOC_CATALOG.map(d => ({
    type: d.type, label: d.label, required: REQUIRED.has(d.type), either: EDU.includes(d.type),
    paper: paper.has(d.type),
    files: (docs ?? []).filter(x => x.doc_type === d.type).map(x => ({
      id: x.id, file_name: x.file_name, uploaded_at: x.uploaded_at,
      can_delete: now - new Date(x.uploaded_at).getTime() < DELETE_WINDOW_MS,
    })),
  }))
  return NextResponse.json({ items })
}

// 上傳（multipart：file, doc_type）
export async function POST(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const doc_type = String(form?.get('doc_type') ?? 'other')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Thiếu tệp / 缺少檔案' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Tệp quá 10MB / 檔案超過 10MB' }, { status: 400 })
  const type = DOC_TYPE_SET.has(doc_type) ? doc_type : 'other'
  const cid = await candidateOf(ctx, true)
  if (!cid) return NextResponse.json({ error: 'Lỗi / 建立資料失敗' }, { status: 500 })

  const owner = ctx.company.ownerId
  const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  const path = `${owner}/${cid}/${type}-${randomUUID()}${ext ? '.' + ext : ''}`
  const { error: upErr } = await ctx.admin.storage.from(APPLY_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || 'application/octet-stream', upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  const { data, error } = await ctx.admin.from('hr_candidate_documents').insert({
    candidate_id: cid, owner_id: owner, doc_type: type, label: DOC_LABEL[type] ?? '其他',
    file_name: file.name.slice(0, 200), storage_path: path,
  }).select('id').single()
  if (error) {
    await ctx.admin.storage.from(APPLY_BUCKET).remove([path])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: data.id })
}

// 刪除自己 24 小時內上傳的檔案。body: { id }
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const cid = await candidateOf(ctx, false)
  const { id } = await req.json().catch(() => ({}))
  if (!cid) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { data: d } = await ctx.admin.from('hr_candidate_documents').select('id, storage_path, uploaded_at')
    .eq('id', String(id ?? '')).eq('candidate_id', cid).maybeSingle()
  if (!d) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (Date.now() - new Date(d.uploaded_at).getTime() >= DELETE_WINDOW_MS) return NextResponse.json({ error: 'Đã quá 24 giờ, liên hệ nhân sự / 超過 24 小時，請聯絡人事' }, { status: 403 })
  await ctx.admin.from('hr_candidate_documents').delete().eq('id', d.id)
  await ctx.admin.storage.from(APPLY_BUCKET).remove([d.storage_path])
  return NextResponse.json({ ok: true })
}
