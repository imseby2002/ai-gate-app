import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getFinanceUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const KIND_MAP: Record<string, string> = {
  '現金': 'cash', '銀行': 'bank', '信用卡': 'credit', '電子錢包': 'ewallet', '其他': 'other',
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { rows } = (await req.json()) as { rows?: Record<string, unknown>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的資料' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []

  const { data: existing } = await supabase
    .from('hr_accounts')
    .select('id, name')
    .eq('owner_id', user.id)

  const existingList = existing || []
  let inserted = 0
  let updated = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const name = String(r.name ?? '').trim()
    if (!name) {
      errors.push({ line, reason: '缺少帳戶名稱' })
      continue
    }

    let kind = String(r.kind ?? 'cash').trim().toLowerCase()
    if (KIND_MAP[kind]) {
      kind = KIND_MAP[kind]
    } else if (!['cash', 'bank', 'credit', 'ewallet', 'other'].includes(kind)) {
      kind = 'cash'
    }

    const payload: Record<string, unknown> = {
      name,
      kind,
      opening_balance: Number(r.opening_balance) || 0,
      currency: String(r.currency ?? 'TWD').trim(),
      note: String(r.note ?? r.notes ?? '').trim(),
    }

    const match = existingList.find(a => a.name.trim().toLowerCase() === name.toLowerCase())
    if (match) {
      const { error } = await supabase
        .from('hr_accounts')
        .update(payload)
        .eq('id', match.id)
      if (error) {
        errors.push({ line, reason: `更新「${name}」失敗: ${error.message}` })
      } else {
        updated++
      }
    } else {
      payload.owner_id = user.id
      payload.archived = false
      payload.sort = 0
      const { error } = await supabase
        .from('hr_accounts')
        .insert(payload)
      if (error) {
        errors.push({ line, reason: `新增「${name}」失敗: ${error.message}` })
      } else {
        inserted++
      }
    }
  }

  return NextResponse.json({ ok: true, inserted, updated, errors })
}
