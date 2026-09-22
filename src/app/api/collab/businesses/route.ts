import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/collab/businesses
// 讓同一個帳號（例如 imseby@gmail.com）能同時管理多家獨立的訂房／客服業務，
// 不需要為每家業務另外申請一個 email 登入。做法：用 service-role 建立一個
// 內部專用的「影子帳號」（真的存在於 auth.users，但沒人知道密碼、不會被拿來
// 登入），再把目前登入者以 admin 角色掛進 bnb_members（booking + cs 兩個模組），
// 這樣新業務就會立刻出現在切換器（/team 頁「我參與協作的對象」）裡。
//
// 這是「一人一業務」限制只存在於 companies/company_members（ERP 側）的例外：
// booking/cs 從設計上就是「user_id = 業務身分」，bnb_members 本來就支援一人
// 協作多個業務，這裡只是補上「建立新業務」這個入口，不需要新增資料表或改 RLS。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json() as { name?: string }
  const businessName = (name ?? '').trim()
  if (!businessName) return NextResponse.json({ error: '請輸入業務名稱' }, { status: 400 })
  if (businessName.length > 60) return NextResponse.json({ error: '業務名稱過長' }, { status: 400 })

  const admin = await createAdminClient()

  const shadowEmail = `shadow-${randomBytes(8).toString('hex')}@internal.im-tourist.com`
  const shadowPassword = randomBytes(24).toString('base64url')

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: shadowEmail,
    password: shadowPassword,
    email_confirm: true,
    user_metadata: { full_name: businessName, user_type: 'external' },
  })
  if (createErr || !created?.user) {
    return NextResponse.json({ error: createErr?.message ?? '建立業務身分失敗' }, { status: 500 })
  }
  const ownerId = created.user.id

  // handle_new_user() 觸發器已自動建立 profiles 列，這裡再次寫入 full_name
  // 保險（避免觸發器版本差異未帶到 metadata 時業務名稱顯示成 email 帳號）。
  await admin.from('profiles').update({ full_name: businessName }).eq('id', ownerId)

  const { error: memberErr } = await admin.from('bnb_members').upsert(
    (['booking', 'cs'] as const).map(scope => ({
      owner_id: ownerId,
      member_id: user.id,
      invited_email: (user.email ?? '').toLowerCase(),
      scope,
      role: 'admin',
      status: 'active',
      invited_by: user.id,
      can_correct_ai: true,
      accepted_at: new Date().toISOString(),
    })),
    { onConflict: 'owner_id,invited_email,scope' },
  )
  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, ownerId, name: businessName })
}
