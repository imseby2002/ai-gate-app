import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import crypto from 'crypto'

async function getFinanceUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const SERVICE_MAP: Record<string, string> = {
  '瓦斯': 'gas', 'gas': 'gas', '冰塊': 'ice', 'ice': 'ice', '一般': '',
}
const PAY_MAP: Record<string, string> = {
  '後付': 'postpaid', 'postpaid': 'postpaid', '預付': 'prepaid', 'prepaid': 'prepaid',
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
    .from('fin_vendors')
    .select('id, name, tax_id')
    .eq('owner_id', user.id)

  const existingList = existing || []
  let inserted = 0
  let updated = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const name = String(r.name ?? '').trim()
    const taxId = String(r.tax_id ?? '').trim()

    if (!name) {
      errors.push({ line, reason: '缺少廠商名稱' })
      continue
    }

    let service = String(r.service ?? '').trim().toLowerCase()
    if (SERVICE_MAP[service] !== undefined) {
      service = SERVICE_MAP[service]
    } else {
      service = ''
    }

    let payTerms = String(r.pay_terms ?? '').trim().toLowerCase()
    if (PAY_MAP[payTerms] !== undefined) {
      payTerms = PAY_MAP[payTerms]
    } else {
      payTerms = ''
    }

    let active = r.active
    if (typeof active === 'string') {
      active = !['false', '0', '否', 'no', '停用', 'inactive'].includes(active.trim().toLowerCase())
    } else if (active === undefined || active === null || active === '') {
      active = true
    }

    // 解析 regions，如果是字串，以逗號或空格切分
    let regions: string[] = []
    if (Array.isArray(r.regions)) {
      regions = r.regions.map(x => String(x).trim()).filter(Boolean)
    } else if (r.regions) {
      regions = String(r.regions).split(/[,，、\s]/).map(x => x.trim()).filter(Boolean)
    }

    const payload: Record<string, unknown> = {
      name,
      tax_id: taxId,
      service,
      regions,
      active: !!active,
      address: String(r.address ?? '').trim(),
      phone: String(r.phone ?? '').trim(),
      contact: String(r.contact ?? '').trim(),
      products: String(r.products ?? '').trim(),
      pay_terms: payTerms,
      billing_cycle: String(r.billing_cycle ?? '').trim(),
      billing_day: r.billing_day ? Number(r.billing_day) || null : null,
      updated_at: new Date().toISOString(),
    }

    // 優先比對統編 > 廠商名稱
    const match = existingList.find(v => {
      if (taxId && v.tax_id && v.tax_id.trim() === taxId) return true
      if (v.name.trim().toLowerCase() === name.toLowerCase()) return true
      return false
    })

    if (match) {
      const { error } = await supabase
        .from('fin_vendors')
        .update(payload)
        .eq('id', match.id)
      if (error) {
        errors.push({ line, reason: `更新「${name}」失敗: ${error.message}` })
      } else {
        updated++
      }
    } else {
      payload.owner_id = user.id
      payload.fill_token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      const { error } = await supabase
        .from('fin_vendors')
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
