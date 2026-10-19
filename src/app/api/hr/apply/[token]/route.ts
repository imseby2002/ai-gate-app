import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FREE_FIELDS, IDENTITY_FIELDS, APPLY_BUCKET, DOC_CATALOG } from '@/lib/hr/apply'
import { EDU, UPLOAD_REQ } from '@/lib/hr/doc-reminders'
import { RESUME_FIELDS, profileOpen, syncCandidateToEmployee } from '@/lib/hr/profile'

type Ctx = { params: Promise<{ token: string }> }

async function findCandidate(admin: ReturnType<typeof createAdminClient>, token: string) {
  const { data } = await admin
    .from('agent_hr_candidates')
    .select('id, user_id, hired_employee_id, identity_locked, profile_edit_until, name, email, position, store, id_number, birthday, gender, native_place, education, resume_text')
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
    .select('id, user_id, name, phone, email, position, store, id_number, birthday, address, stage, hired_employee_id, identity_locked, profile_edit_until, notify_channel, gender, native_place, education, resume_text')
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

  const safe = { ...cand, profile_open: profileOpen(cand) } as Record<string, unknown>
  delete safe.user_id
  const required = new Set([...UPLOAD_REQ.map(d => d.type), ...EDU])
  const catalog = DOC_CATALOG.map(d => ({ type: d.type, label: d.label, copy: d.copy, required: required.has(d.type), either: EDU.includes(d.type) }))
  return NextResponse.json({ candidate: safe, documents, catalog })
}

// 應徵者以 token 更新自己的基本資料（僅限白名單欄位）
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const admin = createAdminClient()
  const cand = await findCandidate(admin, token)
  if (!cand) return NextResponse.json({ error: '連結無效' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}

  // 電話、地址、通知方式：隨時可改
  for (const f of FREE_FIELDS) {
    if (body[f] === undefined) continue
    if (f === 'notify_channel' && body[f] !== 'email' && body[f] !== 'zalo') {
      return NextResponse.json({ error: '通知方式僅能是 email 或 zalo' }, { status: 400 })
    }
    updates[f] = body[f]
  }
  // 基本資料與履歷：人事關閉或超過開放期限後不得變更（值不同即擋下）
  const rec = cand as Record<string, unknown>
  const open = profileOpen(cand)
  let resumeChanged = false
  for (const f of [...IDENTITY_FIELDS, ...RESUME_FIELDS]) {
    if (body[f] === undefined) continue
    const next = f === 'birthday' ? (body[f] || null) : (f === 'resume_text' ? String(body[f] ?? '').slice(0, 5000) : body[f])
    if (norm(next) === norm(rec[f])) continue
    if (!open) return NextResponse.json({ error: '履歷修改已關閉，請聯繫人事開放後再修改 / Đã khóa chỉnh sửa, vui lòng liên hệ nhân sự' }, { status: 403 })
    updates[f] = next
    resumeChanged = true
  }
  if (resumeChanged) updates.resume_updated_at = new Date().toISOString()
  if (updates.name !== undefined && !String(updates.name).trim()) {
    return NextResponse.json({ error: '姓名不可空白' }, { status: 400 })
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })

  const { error } = await admin
    .from('agent_hr_candidates').update(updates).eq('id', cand.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 已錄用：同步到員工資料
  await syncCandidateToEmployee(admin, cand.user_id, cand.id, updates)
  return NextResponse.json({ ok: true })
}
