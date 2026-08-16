import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { genToken } from '@/lib/hr/apply'

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

  const apply_token = genToken()
  const { data, error } = await admin
    .from('agent_hr_candidates')
    .insert({
      user_id: setting.owner_id,
      name,
      phone: String(body.phone ?? ''),
      email: String(body.email ?? ''),
      position: String(body.position ?? ''),
      store: String(body.store ?? ''),
      source: 'web',
      stage: 'new',
      apply_token,
    })
    .select('id, apply_token').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ token: data.apply_token })
}
