import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { APPLY_BUCKET } from '@/lib/hr/apply'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

// 後台檢視某應徵者的文件（含簽章 URL）
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
