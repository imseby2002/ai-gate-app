import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FREE_FIELDS, IDENTITY_FIELDS, APPLY_BUCKET } from '@/lib/hr/apply'

type Ctx = { params: Promise<{ token: string }> }

async function findCandidate(admin: ReturnType<typeof createAdminClient>, token: string) {
  const { data } = await admin
    .from('agent_hr_candidates')
    .select('id, user_id, identity_locked, name, email, position, store, id_number, birthday')
    .eq('apply_token', token).single()
  return data
}

const norm = (v: unknown) => (v === null || v === undefined ? '' : String(v))

// 應徵者以 token 讀取自己的資料與文件
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const admin = createAdminClient()
  const { data: cand } = await admin
    .from('agent_hr_candidates')
    .select('id, user_id, name, phone, email, position, store, id_number, birthday, address, stage, hired_employee_id, identity_locked')
    .eq('apply_token', token).single()
  if (!cand) return NextResponse.json({ error: '連結無效' }, { status: 404 })

  const { data: docs } = await admin
    .from('hr_candidate_documents')
    .select('id, doc_type, label, file_name, storage_path, uploaded_at')
    .eq('candidate_id', cand.id).order('uploaded_at', { ascending: false })

  const documents = await Promise.all((docs ?? []).map(async d => {
    const { data: signed } = await admin.storage.from(APPLY_BUCKET).createSignedUrl(d.storage_path, 3600)
    return { id: d.id, doc_type: d.doc_type, label: d.label, file_name: d.file_name, uploaded_at: d.uploaded_at, url: signed?.signedUrl ?? '' }
  }))

  const safe = { ...cand } as Record<string, unknown>
  delete safe.user_id
  return NextResponse.json({ candidate: safe, documents })
}

// 應徵者以 token 更新自己的基本資料（僅限白名單欄位）
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const admin = createAdminClient()
  const cand = await findCandidate(admin, token)
  if (!cand) return NextResponse.json({ error: '連結無效' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}

  // 電話、地址：隨時可改
  for (const f of FREE_FIELDS) {
    if (body[f] !== undefined) updates[f] = body[f]
  }
  // 重要基本資料：鎖定時不得變更（值不同即擋下）
  const rec = cand as Record<string, unknown>
  for (const f of IDENTITY_FIELDS) {
    if (body[f] === undefined) continue
    const next = f === 'birthday' ? (body[f] || null) : body[f]
    if (cand.identity_locked && norm(next) !== norm(rec[f])) {
      return NextResponse.json({ error: '基本資料已鎖定，請聯繫人事開放後再修改' }, { status: 403 })
    }
    updates[f] = next
  }
  if (updates.name !== undefined && !String(updates.name).trim()) {
    return NextResponse.json({ error: '姓名不可空白' }, { status: 400 })
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })

  const { error } = await admin
    .from('agent_hr_candidates').update(updates).eq('id', cand.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
