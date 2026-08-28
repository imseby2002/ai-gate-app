import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUnitContext } from '@/lib/auth/unit-access'
import { APPLY_BUCKET } from '@/lib/hr/apply'

const MAX_SIZE = 20 * 1024 * 1024
const s = (v: unknown) => String(v ?? '').trim()
const dateOrNull = (v: unknown) => { const t = s(v); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null }

// 新增勞動合同（multipart：candidate_id, contract_no, sign_date, start_date, end_date, note, [file]）
export async function POST(req: NextRequest) {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin, ownerId } = ctx
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: '格式錯誤' }, { status: 400 })
  const candidateId = s(form.get('candidate_id'))
  if (!candidateId) return NextResponse.json({ error: 'candidate_id required' }, { status: 400 })

  // 取員工連結（若已轉正）
  const { data: cand } = await admin.from('agent_hr_candidates').select('hired_employee_id, user_id').eq('id', candidateId).eq('user_id', ownerId).single()
  if (!cand) return NextResponse.json({ error: 'not found' }, { status: 404 })

  let storage_path = '', file_name = ''
  const file = form.get('file')
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_SIZE) return NextResponse.json({ error: '檔案超過 20MB' }, { status: 400 })
    const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
    const path = `${ownerId}/contracts/${candidateId}-${randomUUID()}${ext ? '.' + ext : ''}`
    const { error: upErr } = await admin.storage.from(APPLY_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || 'application/octet-stream' })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    storage_path = path; file_name = file.name
  }

  const { data, error } = await admin.from('hr_contracts').insert({
    owner_id: ownerId, candidate_id: candidateId, employee_id: cand.hired_employee_id ?? null,
    contract_no: s(form.get('contract_no')), sign_date: dateOrNull(form.get('sign_date')),
    start_date: dateOrNull(form.get('start_date')), end_date: dateOrNull(form.get('end_date')),
    note: s(form.get('note')), file_name, storage_path,
  }).select('id').single()
  if (error) { if (storage_path) await admin.storage.from(APPLY_BUCKET).remove([storage_path]); return NextResponse.json({ error: error.message }, { status: 500 }) }
  return NextResponse.json({ id: data.id })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin, ownerId } = ctx
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data: c } = await admin.from('hr_contracts').select('storage_path').eq('id', id).eq('owner_id', ownerId).single()
  const { error } = await admin.from('hr_contracts').delete().eq('id', id).eq('owner_id', ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (c?.storage_path) await admin.storage.from(APPLY_BUCKET).remove([c.storage_path]).catch(() => {})
  return NextResponse.json({ ok: true })
}
