import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { APPLY_BUCKET, DOC_LABEL, DOC_TYPE_SET } from '@/lib/hr/apply'

type Ctx = { params: Promise<{ token: string }> }
const MAX_SIZE = 10 * 1024 * 1024

async function findCandidate(admin: ReturnType<typeof createAdminClient>, token: string) {
  const { data } = await admin
    .from('agent_hr_candidates').select('id, user_id').eq('apply_token', token).single()
  return data
}

// 應徵者以 token 上傳文件（multipart：file, doc_type）
export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const admin = createAdminClient()
  const cand = await findCandidate(admin, token)
  if (!cand) return NextResponse.json({ error: '連結無效' }, { status: 404 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const doc_type = String(form?.get('doc_type') ?? 'other')
  if (!(file instanceof File)) return NextResponse.json({ error: '缺少檔案' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: '檔案超過 10MB' }, { status: 400 })
  const type = DOC_TYPE_SET.has(doc_type) ? doc_type : 'other'

  const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  const path = `${cand.user_id}/${cand.id}/${type}-${randomUUID()}${ext ? '.' + ext : ''}`
  const buf = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await admin.storage.from(APPLY_BUCKET)
    .upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data, error } = await admin.from('hr_candidate_documents').insert({
    candidate_id: cand.id,
    owner_id: cand.user_id,
    doc_type: type,
    label: DOC_LABEL[type] ?? '其他',
    file_name: file.name,
    storage_path: path,
  }).select('id, doc_type, label, file_name, uploaded_at').single()
  if (error) {
    await admin.storage.from(APPLY_BUCKET).remove([path])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ document: data })
}

// 應徵者刪除自己的文件。body: { id }
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const admin = createAdminClient()
  const cand = await findCandidate(admin, token)
  if (!cand) return NextResponse.json({ error: '連結無效' }, { status: 404 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data: doc } = await admin.from('hr_candidate_documents')
    .select('id, storage_path').eq('id', id).eq('candidate_id', cand.id).single()
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await admin.storage.from(APPLY_BUCKET).remove([doc.storage_path])
  await admin.from('hr_candidate_documents').delete().eq('id', doc.id)
  return NextResponse.json({ ok: true })
}
