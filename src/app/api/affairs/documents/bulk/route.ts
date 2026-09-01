import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAffairsUser() {
  const ctx = await getUnitContext('affairs')
  if (!ctx.ok) return { user: null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const TYPE_MAP: Record<string, string> = {
  '門市租約': 'lease', '租約': 'lease', 'lease': 'lease',
  '廠商合約': 'contract', '合約': 'contract', 'contract': 'contract',
  '衛生證': 'license', '證照': 'license', 'license': 'license',
  '其他': 'other', 'other': 'other',
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAffairsUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { rows } = (await req.json()) as { rows?: Record<string, unknown>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的資料' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []

  const { data: existing } = await supabase
    .from('affair_documents')
    .select('id, title, store_code')
    .eq('owner_id', user.id)

  const existingList = existing || []
  let inserted = 0
  let updated = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const title = String(r.title ?? '').trim()
    const storeCode = String(r.store_code ?? '').trim().toUpperCase()

    if (!title) {
      errors.push({ line, reason: '缺少文件標題' })
      continue
    }

    let docType = String(r.doc_type ?? 'other').trim().toLowerCase()
    if (TYPE_MAP[docType]) {
      docType = TYPE_MAP[docType]
    } else if (!['lease', 'contract', 'license', 'other'].includes(docType)) {
      docType = 'other'
    }

    const payload: Record<string, unknown> = {
      doc_type: docType,
      title,
      store_code: storeCode,
      counterparty: String(r.counterparty ?? '').trim(),
      effective_date: r.effective_date ? String(r.effective_date).trim() : null,
      expiry_date: r.expiry_date ? String(r.expiry_date).trim() : null,
      payment_day: r.payment_day ? Number(r.payment_day) || null : null,
      remind_days_before: Number(r.remind_days_before) || 30,
      pay_remind_days_before: Number(r.pay_remind_days_before) || 5,
      status: String(r.status ?? 'active').trim() === 'archived' ? 'archived' : 'active',
      note: String(r.note ?? r.notes ?? '').trim(),
      updated_at: new Date().toISOString(),
    }

    const match = existingList.find(d => d.title.trim().toLowerCase() === title.toLowerCase() && (!storeCode || d.store_code === storeCode))
    if (match) {
      const { error } = await supabase
        .from('affair_documents')
        .update(payload)
        .eq('id', match.id)
      if (error) {
        errors.push({ line, reason: `更新「${title}」失敗: ${error.message}` })
      } else {
        updated++
      }
    } else {
      payload.owner_id = user.id
      payload.confirmed = true
      const { error } = await supabase
        .from('affair_documents')
        .insert(payload)
      if (error) {
        errors.push({ line, reason: `新增「${title}」失敗: ${error.message}` })
      } else {
        inserted++
      }
    }
  }

  return NextResponse.json({ ok: true, inserted, updated, errors })
}
