import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getHrContext } from '@/lib/auth/unit-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { APPLY_BUCKET, DOC_LABEL, DOC_TYPE_SET } from '@/lib/hr/apply'

const MAX_SIZE = 10 * 1024 * 1024

async function getAdminUser() {
  const ctx = await getHrContext('recruit')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin , status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin , status: ctx.status }
}

// 後台檢視某應徵者的文件（含簽章 URL）
export async function GET(req: NextRequest) {
  const { user, supabase , status } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

  const candidateId = new URL(req.url).searchParams.get('candidate_id')
  if (!candidateId) return NextResponse.json({ error: 'candidate_id required' }, { status: 400 })

  const { data: docs, error } = await supabase
    .from('hr_candidate_documents')
    .select('id, doc_type, label, file_name, storage_path, uploaded_at')
    .eq('candidate_id', candidateId).eq('owner_id', user.id)
    .order('uploaded_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const admin = createAdminClient()
  const documents = await Promise.all((docs ?? []).map(async d => {
    const { data: signed } = await admin.storage.from(APPLY_BUCKET).createSignedUrl(d.storage_path, 3600)
    return { id: d.id, doc_type: d.doc_type, label: d.label, file_name: d.file_name, uploaded_at: d.uploaded_at, url: signed?.signedUrl ?? '' }
  }))
  return NextResponse.json({ documents })
}

// 人事代員工上傳文件（紙本已交人事、員工手上沒有檔案時）。form: candidate_id, doc_type, file
export async function POST(req: NextRequest) {
  const ctx = await getHrContext('recruit', 'staff')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const candidateId = String(form?.get('candidate_id') ?? '')
  const docType = String(form?.get('doc_type') ?? 'other')
  if (!(file instanceof File)) return NextResponse.json({ error: '缺少檔案' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: '檔案超過 10MB' }, { status: 400 })
  const { data: cand } = await ctx.admin.from('agent_hr_candidates').select('id').eq('id', candidateId).eq('user_id', ctx.ownerId).maybeSingle()
  if (!cand) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const type = DOC_TYPE_SET.has(docType) ? docType : 'other'
  const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  const path = `${ctx.ownerId}/${cand.id}/${type}-${randomUUID()}${ext ? '.' + ext : ''}`
  const { error: upErr } = await ctx.admin.storage.from(APPLY_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || 'application/octet-stream', upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  const { data, error } = await ctx.admin.from('hr_candidate_documents').insert({
    candidate_id: cand.id, owner_id: ctx.ownerId, doc_type: type, label: DOC_LABEL[type] ?? '其他',
    file_name: file.name.slice(0, 200), storage_path: path,
  }).select('id').single()
  if (error) {
    await ctx.admin.storage.from(APPLY_BUCKET).remove([path])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: data.id })
}

// 人事刪除文件。body: { id }
export async function DELETE(req: NextRequest) {
  const ctx = await getHrContext('recruit', 'staff')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const { id } = await req.json().catch(() => ({}))
  const { data: d } = await ctx.admin.from('hr_candidate_documents').select('id, storage_path')
    .eq('id', String(id ?? '')).eq('owner_id', ctx.ownerId).maybeSingle()
  if (!d) return NextResponse.json({ error: 'not found' }, { status: 404 })
  await ctx.admin.from('hr_candidate_documents').delete().eq('id', d.id)
  await ctx.admin.storage.from(APPLY_BUCKET).remove([d.storage_path])
  return NextResponse.json({ ok: true })
}
