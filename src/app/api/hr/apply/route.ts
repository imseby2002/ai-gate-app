import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { genToken } from '@/lib/hr/apply'
import { notifyHR } from '@/lib/hr/notify'
import { openUntil } from '@/lib/hr/profile'
import { POSITIONS, type UnitKind } from '@/lib/hr/apply-units'

// 公開應徵表單送出（無需登入）。body: { code, name, phone, email, position, store }
export async function POST(req: NextRequest) {
  const admin = createAdminClient()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const code = String(body.code ?? '').trim()
  const name = String(body.name ?? '').trim()
  if (!code) return NextResponse.json({ error: '缺少應徵代碼' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '請填寫姓名' }, { status: 400 })

  // 由公司代碼決定應徵歸屬
  const { data: setting } = await admin
    .from('hr_settings').select('owner_id').eq('apply_code', code).single()
  if (!setting?.owner_id) return NextResponse.json({ error: '應徵代碼無效' }, { status: 404 })

  // 依單位與職位推定類別（正職／計時）；單位為辦公室或工廠以外的名稱時視為門市
  const store = String(body.store ?? '').trim().slice(0, 100)
  const position = String(body.position ?? '').trim().slice(0, 100)
  const { data: unit } = store ? await admin.from('fin_stores').select('unit_type').eq('owner_id', setting.owner_id).eq('code', store).maybeSingle() : { data: null }
  const kind: UnitKind = store === '辦公室' ? 'office' : unit?.unit_type === 'factory' || store === '工廠' ? 'factory' : 'store'
  const staff_category = POSITIONS[kind].find(p => p.value === position)?.category ?? ''

  const apply_token = genToken()
  const { data, error } = await admin
    .from('agent_hr_candidates')
    .insert({
      user_id: setting.owner_id,
      name,
      phone: String(body.phone ?? ''),
      email: String(body.email ?? ''),
      position,
      store,
      staff_category,
      source: 'web',
      stage: 'new',
      apply_token,
      profile_edit_until: await openUntil(admin, setting.owner_id),
    })
    .select('id, apply_token').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 通知人事：有新應徵
  await notifyHR(setting.owner_id, {
    kind: 'new_application',
    title: '🆕 新應徵者',
    body: `${name}${body.position ? `（應徵 ${body.position}）` : ''}${body.store ? `｜單位 ${body.store}` : ''} 已送出應徵申請。`,
    candidateId: data.id,
  }).catch(() => {})

  return NextResponse.json({ token: data.apply_token })
}
