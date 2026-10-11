// GET  /api/marketing/connector/managed — 查詢自己的「AI-GATE 代管 AdsPower」申請／開通狀態（?reveal=1 取得登入密碼）
// POST /api/marketing/connector/managed — 申請代管（未申請、被拒或已停用時可重新申請）
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { decryptSecret } from '@/lib/crypto/secret'

export async function GET(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  if (guard.user.isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await createAdminClient()
    .from('marketing_adspower_managed')
    .select('status, login_account, login_password_enc, group_name, requested_at, activated_at')
    .eq('user_id', guard.user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: `讀取失敗：${error.message}` }, { status: 500 })
  if (!data) return NextResponse.json({ managed: null })

  const active = data.status === 'active'
  const reveal = active && req.nextUrl.searchParams.get('reveal') === '1'
  let password: string | null = null
  if (reveal) {
    try {
      password = decryptSecret(data.login_password_enc)
    } catch {
      return NextResponse.json({ error: '密碼解密失敗，請聯絡管理員' }, { status: 500 })
    }
  }
  return NextResponse.json({
    managed: {
      status: data.status,
      login_account: active ? data.login_account : null,
      group_name: active ? data.group_name : null,
      has_password: active && !!data.login_password_enc,
      password,
      requested_at: data.requested_at,
      activated_at: data.activated_at,
    },
  })
}

export async function POST(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  if (guard.user.isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const contact = String(body.contact ?? '').trim().slice(0, 200)
  const note = String(body.note ?? '').trim().slice(0, 1000)
  if (!contact) return NextResponse.json({ error: '請填寫聯絡方式' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('marketing_adspower_managed')
    .select('status')
    .eq('user_id', guard.user.id)
    .maybeSingle()
  if (existing && (existing.status === 'pending' || existing.status === 'active')) {
    return NextResponse.json({ error: existing.status === 'active' ? '代管帳號已開通' : '已送出申請，請等待管理員開通' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const { error } = await admin.from('marketing_adspower_managed').upsert({
    user_id: guard.user.id,
    status: 'pending',
    contact,
    note: note || null,
    requested_at: now,
    updated_at: now,
  })
  if (error) return NextResponse.json({ error: `申請失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true })
}
