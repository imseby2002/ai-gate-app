import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'affair-docs'
const MAX_SIZE = 20 * 1024 * 1024
const DOC_TYPES = new Set(['lease', 'contract', 'license', 'other'])
const STATUSES = new Set(['active', 'expired', 'archived'])

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

const s = (v: unknown) => String(v ?? '').trim()
const dateOrNull = (v: unknown) => { const t = s(v); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null }
const dayOrNull = (v: unknown) => { const n = parseInt(s(v)); return n >= 1 && n <= 31 ? n : null }

// 清單（可依類別／狀態／門市過濾），附簽章 URL
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  let q = supabase.from('affair_documents').select('*').eq('owner_id', user.id)
  const type = s(sp.get('doc_type'))
  if (DOC_TYPES.has(type)) q = q.eq('doc_type', type)
  const status = s(sp.get('status'))
  if (STATUSES.has(status)) q = q.eq('status', status)
  const { data, error } = await q.order('expiry_date', { ascending: true, nullsFirst: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const admin = createAdminClient()
  const documents = await Promise.all((data ?? []).map(async d => {
    let url = ''
    if (d.storage_path) {
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(d.storage_path, 3600)
      url = signed?.signedUrl ?? ''
    }
    return { ...d, url }
  }))
  return NextResponse.json({ documents })
}

// 建檔（multipart：可含 file ＋ 各欄位）。AI 辨識於階段 3 補上，這裡先手動填。
export async function POST(req: NextRequest) {
  const { user } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: '格式錯誤' }, { status: 400 })
  const file = form.get('file')
  const doc_type = DOC_TYPES.has(s(form.get('doc_type'))) ? s(form.get('doc_type')) : 'other'

  let storage_path = '', file_name = '', mime = ''
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_SIZE) return NextResponse.json({ error: '檔案超過 20MB' }, { status: 400 })
    const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
    const path = `${user.id}/${doc_type}-${randomUUID()}${ext ? '.' + ext : ''}`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await admin.storage.from(BUCKET)
      .upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    storage_path = path; file_name = file.name; mime = file.type || ''
  }

  const { data, error } = await admin.from('affair_documents').insert({
    owner_id: user.id, doc_type,
    title: s(form.get('title')),
    store_code: s(form.get('store_code')),
    counterparty: s(form.get('counterparty')),
    effective_date: dateOrNull(form.get('effective_date')),
    expiry_date: dateOrNull(form.get('expiry_date')),
    payment_day: dayOrNull(form.get('payment_day')),
    remind_days_before: Math.max(0, parseInt(s(form.get('remind_days_before'))) || 30),
    pay_remind_days_before: Math.max(0, parseInt(s(form.get('pay_remind_days_before'))) || 5),
    note: s(form.get('note')),
    status: 'active', confirmed: true,
    storage_path, file_name, mime,
  }).select('id').single()
  if (error) {
    if (storage_path) await admin.storage.from(BUCKET).remove([storage_path])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: data.id })
}

// 編輯欄位／狀態。body: { id, ...fields }
export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.doc_type !== undefined && DOC_TYPES.has(s(b.doc_type))) upd.doc_type = s(b.doc_type)
  if (b.title !== undefined) upd.title = s(b.title)
  if (b.store_code !== undefined) upd.store_code = s(b.store_code)
  if (b.counterparty !== undefined) upd.counterparty = s(b.counterparty)
  if (b.effective_date !== undefined) upd.effective_date = dateOrNull(b.effective_date)
  if (b.expiry_date !== undefined) upd.expiry_date = dateOrNull(b.expiry_date)
  if (b.payment_day !== undefined) upd.payment_day = dayOrNull(b.payment_day)
  if (b.remind_days_before !== undefined) upd.remind_days_before = Math.max(0, Number(b.remind_days_before) || 0)
  if (b.pay_remind_days_before !== undefined) upd.pay_remind_days_before = Math.max(0, Number(b.pay_remind_days_before) || 0)
  if (b.note !== undefined) upd.note = s(b.note)
  if (b.status !== undefined && STATUSES.has(s(b.status))) upd.status = s(b.status)
  if (b.confirmed !== undefined) upd.confirmed = !!b.confirmed
  const { error } = await supabase.from('affair_documents').update(upd).eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// 刪除（連同檔案）。body: { id }
export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data: doc } = await supabase.from('affair_documents').select('storage_path').eq('id', id).eq('owner_id', user.id).single()
  const { error } = await supabase.from('affair_documents').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (doc?.storage_path) await createAdminClient().storage.from(BUCKET).remove([doc.storage_path]).catch(() => {})
  return NextResponse.json({ ok: true })
}
