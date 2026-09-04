import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getFinanceUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const METHOD_MAP: Record<string, string> = {
  '人工匯入': 'import', '匯入': 'import', '廠商填': 'vendor', '廠商': 'vendor', '手動': 'manual',
}

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getFinanceUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const { rows } = (await req.json()) as { rows?: Record<string, unknown>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的資料' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []

  const { data: existing } = await supabase
    .from('fin_expense_categories')
    .select('id, code')
    .eq('owner_id', user.id)

  const existingList = existing || []
  let inserted = 0
  let updated = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const code = String(r.code ?? '').trim().toUpperCase()
    const name = String(r.name ?? code).trim()

    if (!code) {
      errors.push({ line, reason: '缺少科目編碼' })
      continue
    }

    let entryMethod = String(r.entry_method ?? 'manual').trim().toLowerCase()
    if (METHOD_MAP[entryMethod]) {
      entryMethod = METHOD_MAP[entryMethod]
    } else if (!['import', 'vendor', 'manual'].includes(entryMethod)) {
      entryMethod = 'manual'
    }

    let vendorService = String(r.vendor_service ?? '').trim().toLowerCase()
    if (vendorService === '瓦斯') vendorService = 'gas'
    if (vendorService === '冰塊') vendorService = 'ice'
    if (!['gas', 'ice'].includes(vendorService)) vendorService = ''

    const payload: Record<string, unknown> = {
      code,
      name: name || code,
      entry_method: entryMethod,
      vendor_service: vendorService,
      sort: Number(r.sort) || 0,
      updated_at: new Date().toISOString(),
    }

    const match = existingList.find(c => c.code.trim().toUpperCase() === code)
    if (match) {
      const { error } = await supabase
        .from('fin_expense_categories')
        .update(payload)
        .eq('id', match.id)
      if (error) {
        errors.push({ line, reason: `更新科目「${code}」失敗: ${error.message}` })
      } else {
        updated++
      }
    } else {
      payload.owner_id = user.id
      const { error } = await supabase
        .from('fin_expense_categories')
        .insert(payload)
      if (error) {
        errors.push({ line, reason: `新增科目「${code}」失敗: ${error.message}` })
      } else {
        inserted++
      }
    }
  }

  return NextResponse.json({ ok: true, inserted, updated, errors })
}
