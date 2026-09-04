import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import crypto from 'crypto'

async function getHrUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getHrUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const { rows } = (await req.json()) as { rows?: Record<string, unknown>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的資料' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []
  let inserted = 0
  let updated = 0

  // 查詢現有所有人員做比對 (by owner_id)
  const { data: existing } = await supabase
    .from('agent_hr_candidates')
    .select('id, name, phone, email, company_email, id_number')
    .eq('owner_id', user.id)

  const existingList = existing || []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const name = String(r.name ?? '').trim()
    if (!name) {
      errors.push({ line, reason: '缺少姓名' })
      continue
    }

    const idNumber = String(r.id_number ?? '').trim()
    const email = String(r.email ?? '').trim()
    const companyEmail = String(r.company_email ?? '').trim()
    const phone = String(r.phone ?? '').trim()

    // 尋找既有紀錄：優先比對 身分證號 > 公司Email > 個人Email > 姓名+電話
    const match = existingList.find(e => {
      if (idNumber && e.id_number && e.id_number.trim() === idNumber) return true
      if (companyEmail && e.company_email && e.company_email.trim().toLowerCase() === companyEmail.toLowerCase()) return true
      if (email && e.email && e.email.trim().toLowerCase() === email.toLowerCase()) return true
      if (name && phone && e.name.trim() === name && e.phone.trim() === phone) return true
      return false
    })

    const payload: Record<string, unknown> = {
      name,
      gender: String(r.gender ?? '').trim(),
      native_place: String(r.native_place ?? '').trim(),
      birthday: r.birthday ? String(r.birthday).trim() : null,
      id_number: idNumber,
      education: String(r.education ?? '').trim(),
      email,
      company_email: companyEmail,
      payroll_no: String(r.payroll_no ?? '').trim(),
      position: String(r.position ?? '').trim(),
      store: String(r.store ?? '').trim(),
      staff_category: String(r.staff_category ?? 'fulltime').trim(),
      phone,
      address: String(r.address ?? '').trim(),
      zalo_user_id: String(r.zalo_user_id ?? '').trim(),
    }

    if (match) {
      const { error } = await supabase
        .from('agent_hr_candidates')
        .update(payload)
        .eq('id', match.id)
      if (error) {
        errors.push({ line, reason: `更新「${name}」失敗: ${error.message}` })
      } else {
        updated++
      }
    } else {
      payload.owner_id = user.id
      payload.apply_token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      payload.stage = 'applied'
      const { error } = await supabase
        .from('agent_hr_candidates')
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
