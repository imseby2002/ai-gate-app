import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { APPLY_BUCKET, DOC_TYPE_SET } from '@/lib/hr/apply'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

// 取得某應徵者的：上傳掃描檔（簽章URL）＋紙本繳交勾選狀態
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const candidateId = new URL(req.url).searchParams.get('candidate_id')
  if (!candidateId) return NextResponse.json({ error: 'candidate_id required' }, { status: 400 })

  const { data: docs } = await supabase
    .from('hr_candidate_documents')
    .select('id, doc_type, label, file_name, storage_path, uploaded_at')
    .eq('candidate_id', candidateId).eq('owner_id', user.id)
    .order('uploaded_at', { ascending: false })

  const { data: checklist } = await supabase
    .from('hr_candidate_checklist')
    .select('doc_key, original_received, copy_received, note')
    .eq('candidate_id', candidateId).eq('owner_id', user.id)

  const admin = createAdminClient()
  const documents = await Promise.all((docs ?? []).map(async d => {
    const { data: signed } = await admin.storage.from(APPLY_BUCKET).createSignedUrl(d.storage_path, 3600)
    return { id: d.id, doc_type: d.doc_type, label: d.label, file_name: d.file_name, uploaded_at: d.uploaded_at, url: signed?.signedUrl ?? '' }
  }))

  return NextResponse.json({ documents, checklist: checklist ?? [] })
}

// 人事勾選紙本繳交狀態。body: { candidate_id, doc_key, original_received?, copy_received?, note? }
export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const candidate_id = String(body.candidate_id ?? '')
  const doc_key = String(body.doc_key ?? '')
  if (!candidate_id || !DOC_TYPE_SET.has(doc_key)) {
    return NextResponse.json({ error: 'candidate_id 與有效 doc_key 為必填' }, { status: 400 })
  }

  const row: Record<string, unknown> = { candidate_id, owner_id: user.id, doc_key, updated_at: new Date().toISOString() }
  if (body.original_received !== undefined) row.original_received = !!body.original_received
  if (body.copy_received !== undefined) row.copy_received = !!body.copy_received
  if (body.note !== undefined) row.note = String(body.note)

  const { error } = await supabase
    .from('hr_candidate_checklist')
    .upsert(row, { onConflict: 'candidate_id,doc_key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
