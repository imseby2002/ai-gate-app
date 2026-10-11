// GET   /api/marketing/connector/managed — 查詢自己的「AI-GATE 代管 AdsPower」狀態（?reveal=1 取得登入密碼）
// POST  /api/marketing/connector/managed — 申請代管（選額度包與月付／年付；未申請、被拒或已停用時可重新申請）
// PATCH /api/marketing/connector/managed — 自動續費開關、下期變更方案、暫停後重新啟用（立即扣一期）
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { decryptSecret } from '@/lib/crypto/secret'
import { isCycle, isPackage, type BillingCycle } from '@/lib/connector/managed-pricing'
import { activateManaged } from '@/lib/connector/managed-billing'

const SELECT = 'status, login_account, login_password_enc, group_name, env_quota, billing_cycle, price_credits, paid_until, auto_renew, next_env_quota, next_billing_cycle, requested_at, activated_at'

export async function GET(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  if (guard.user.isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await createAdminClient()
    .from('marketing_adspower_managed')
    .select(SELECT)
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
  const { login_password_enc, login_account, group_name, ...rest } = data
  return NextResponse.json({
    managed: {
      ...rest,
      login_account: active ? login_account : null,
      group_name: active ? group_name : null,
      has_password: active && !!login_password_enc,
      password,
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
  const envQuota = Number(body.env_quota)
  const cycle = body.billing_cycle
  if (!contact) return NextResponse.json({ error: '請填寫聯絡方式' }, { status: 400 })
  if (!isPackage(envQuota) || !isCycle(cycle)) return NextResponse.json({ error: '請選擇環境數與付款週期' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('marketing_adspower_managed')
    .select('status')
    .eq('user_id', guard.user.id)
    .maybeSingle()
  if (existing && ['pending', 'active', 'suspended'].includes(existing.status)) {
    const msg = existing.status === 'pending' ? '已送出申請，請等待管理員開通' : '已有代管帳號，請改用變更方案'
    return NextResponse.json({ error: msg }, { status: 409 })
  }

  const now = new Date().toISOString()
  const { error } = await admin.from('marketing_adspower_managed').upsert({
    user_id: guard.user.id,
    status: 'pending',
    contact,
    note: note || null,
    env_quota: envQuota,
    billing_cycle: cycle,
    next_env_quota: null,
    next_billing_cycle: null,
    requested_at: now,
    updated_at: now,
  })
  if (error) return NextResponse.json({ error: `申請失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  if (guard.user.isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = guard.user.id

  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('marketing_adspower_managed')
    .select('status, env_quota, billing_cycle')
    .eq('user_id', userId)
    .maybeSingle()
  if (!row || !['active', 'suspended'].includes(row.status)) {
    return NextResponse.json({ error: '尚未開通代管帳號' }, { status: 404 })
  }

  const envQuota = body.env_quota === undefined ? null : Number(body.env_quota)
  const cycle = body.billing_cycle === undefined ? null : body.billing_cycle
  if (envQuota !== null && !isPackage(envQuota)) return NextResponse.json({ error: '不支援的環境數' }, { status: 400 })
  if (cycle !== null && !isCycle(cycle)) return NextResponse.json({ error: '不支援的付款週期' }, { status: 400 })

  // 暫停中：以（新）方案立即扣一期並恢復
  if (body.action === 'reactivate') {
    if (row.status !== 'suspended') return NextResponse.json({ error: '代管帳號未暫停' }, { status: 400 })
    const charge = await activateManaged(admin, userId, envQuota ?? row.env_quota, (cycle ?? row.billing_cycle) as BillingCycle, { auto_renew: true })
    if (!charge.ok) {
      const insufficient = charge.reason === 'insufficient'
      return NextResponse.json(
        { error: insufficient ? `點數不足，需要 ${charge.price} 點，請先儲值` : '扣款失敗，請稍後再試' },
        { status: insufficient ? 402 : 500 },
      )
    }
    return NextResponse.json({ success: true, charged: charge.price })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.auto_renew === 'boolean') update.auto_renew = body.auto_renew
  // 變更方案於下次續費生效；與目前相同則清除
  if (envQuota !== null || cycle !== null) {
    const nextQuota = envQuota ?? row.env_quota
    const nextCycle = cycle ?? row.billing_cycle
    const same = nextQuota === row.env_quota && nextCycle === row.billing_cycle
    update.next_env_quota = same ? null : nextQuota
    update.next_billing_cycle = same ? null : nextCycle
  }
  const { error } = await admin.from('marketing_adspower_managed').update(update).eq('user_id', userId)
  if (error) return NextResponse.json({ error: `更新失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true })
}
