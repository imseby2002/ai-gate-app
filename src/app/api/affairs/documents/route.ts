import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUnitContext } from '@/lib/auth/unit-access'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'affair-docs'
const MAX_SIZE = 20 * 1024 * 1024
const DOC_TYPES = new Set([
  'lease',            // 門市租約
  'sanitary_cert',    // 門市衛生證
  'company_license',  // 公司執照
  'patent_cert',      // 專利證書
  'contract',         // 廠商合約
  'license',          // 門市衛生證 (相容歷史)
  'other',            // 其他文書
])
const STATUSES = new Set(['active', 'expired', 'archived'])

async function getAdminUser() {
  const ctx = await getUnitContext('affairs')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const s = (v: unknown) => String(v ?? '').trim()
const dateOrNull = (v: unknown) => { const t = s(v); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null }
const dayOrNull = (v: unknown) => { const n = parseInt(s(v)); return n >= 1 && n <= 31 ? n : null }
const numOrNull = (v: unknown) => { const n = Number(s(v)); return !isNaN(n) && s(v) !== '' ? n : null }

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
    const extra = (d.ai_extracted as Record<string, any>) ?? {}
    return {
      ...d,
      deposit: d.deposit ?? extra.deposit ?? null,
      monthly_rent: d.monthly_rent ?? extra.monthly_rent ?? null,
      contract_text: d.contract_text ?? extra.contract_text ?? '',
      is_renewed: d.is_renewed ?? extra.is_renewed ?? false,
      remind_days_before: Number(d.remind_days_before) || 90,
      remind_days_stage2: d.remind_days_stage2 ?? extra.remind_days_stage2 ?? 30,
      remind_days_urgent: d.remind_days_urgent ?? extra.remind_days_urgent ?? 15,
      pay_remind_days_before: Number(d.pay_remind_days_before) || 3,
      pay_remind_days_2: d.pay_remind_days_2 ?? extra.pay_remind_days_2 ?? 1,
      url,
    }
  }))
  return NextResponse.json({ documents })
}

// 建檔（multipart：可含 file ＋ 各欄位）。
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

  const deposit = numOrNull(form.get('deposit'))
  const monthly_rent = numOrNull(form.get('monthly_rent'))
  const contract_text = s(form.get('contract_text'))
  const is_renewed = form.get('is_renewed') === 'true'
  const remind_days_before = Math.max(0, parseInt(s(form.get('remind_days_before'))) || 90)
  const remind_days_stage2 = Math.max(0, parseInt(s(form.get('remind_days_stage2'))) || 30)
  const remind_days_urgent = Math.max(0, parseInt(s(form.get('remind_days_urgent'))) || 15)
  const pay_remind_days_before = Math.max(0, parseInt(s(form.get('pay_remind_days_before'))) || 3)
  const pay_remind_days_2 = Math.max(0, parseInt(s(form.get('pay_remind_days_2'))) || 1)

  const ai_extracted = {
    deposit,
    monthly_rent,
    contract_text,
    is_renewed,
    remind_days_stage2,
    remind_days_urgent,
    pay_remind_days_2,
  }

  const insertPayload: Record<string, unknown> = {
    owner_id: user.id,
    doc_type,
    title: s(form.get('title')),
    store_code: s(form.get('store_code')),
    counterparty: s(form.get('counterparty')),
    effective_date: dateOrNull(form.get('effective_date')),
    expiry_date: dateOrNull(form.get('expiry_date')),
    payment_day: dayOrNull(form.get('payment_day')),
    remind_days_before,
    pay_remind_days_before,
    note: s(form.get('note')),
    status: 'active',
    confirmed: true,
    storage_path,
    file_name,
    mime,
    ai_extracted,
  }

  const { data, error } = await admin.from('affair_documents').insert(insertPayload).select('id').single()
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

  // 先讀取既有資料以維護 ai_extracted 結構化內容
  const { data: exist } = await supabase.from('affair_documents').select('ai_extracted').eq('id', id).eq('owner_id', user.id).single()
  const currentExt = (exist?.ai_extracted as Record<string, any>) ?? {}

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

  // 更新擴充欄位至 ai_extracted
  if (b.deposit !== undefined) currentExt.deposit = numOrNull(b.deposit)
  if (b.monthly_rent !== undefined) currentExt.monthly_rent = numOrNull(b.monthly_rent)
  if (b.contract_text !== undefined) currentExt.contract_text = s(b.contract_text)
  if (b.is_renewed !== undefined) currentExt.is_renewed = !!b.is_renewed
  if (b.remind_days_stage2 !== undefined) currentExt.remind_days_stage2 = Math.max(0, Number(b.remind_days_stage2) || 0)
  if (b.remind_days_urgent !== undefined) currentExt.remind_days_urgent = Math.max(0, Number(b.remind_days_urgent) || 0)
  if (b.pay_remind_days_2 !== undefined) currentExt.pay_remind_days_2 = Math.max(0, Number(b.pay_remind_days_2) || 0)

  upd.ai_extracted = currentExt

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
