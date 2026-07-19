import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBnbContext } from '@/lib/bnb/context'
import { getCsEntitlements } from '@/lib/cs/entitlements'
import { Resend } from 'resend'

// 純防灌爆用的安全上限，跟方案的免費額度是兩件事——免費額度用完仍可送出（改收費），
// 但不能無限送出洗版客服信箱。
const HARD_CAP_PER_MONTH = 10

// POST /api/marketing/cs-setup-request
// 民宿擁有者不會自己綁定頻道/設知識庫時，送出「找人幫我設定」請求。
// 存進 cs_setup_requests，並 email 通知客服人員跟進。
// 每個方案的免費額度不同（見 getCsEntitlements）；超過免費額度仍可送出，
// 但會標記 is_free=false 需另外收費——目前是人工對帳，尚未接自動扣款。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { industry = 'homestay', contact = '', note = '' } = await req.json()

  // 用 admin client 查方案與計數：RLS 只讓使用者看到自己送出的請求，
  // 但額度要以民宿（owner_id）為單位，涵蓋所有協作者送出的請求。
  const admin = createAdminClient()
  const { features } = await getCsEntitlements(admin, ctx.ownerId)

  const nowTaipei = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const monthStart = `${nowTaipei.getFullYear()}-${String(nowTaipei.getMonth() + 1).padStart(2, '0')}-01T00:00:00+08:00`
  const { count } = await admin
    .from('cs_setup_requests')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ctx.ownerId)
    .gte('created_at', monthStart)

  const usedThisMonth = count ?? 0

  if (usedThisMonth >= HARD_CAP_PER_MONTH) {
    return NextResponse.json(
      { error: '本月申請次數過多，請聯繫我們確認狀況。' },
      { status: 429 },
    )
  }

  // 新會員首次免費：這個民宿（owner）從來沒送過協助設定請求 → 第一次免費（不分方案）
  const { count: everCount } = await admin
    .from('cs_setup_requests')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ctx.ownerId)
  const isFirstEver = (everCount ?? 0) === 0

  const isFree = isFirstEver || usedThisMonth < features.assistedSetup.freePerMonth
  const priceUsd = features.assistedSetup.priceUsd

  const { data: row, error } = await supabase
    .from('cs_setup_requests')
    .insert({
      user_id: ctx.user.id,
      owner_id: ctx.ownerId,
      industry,
      contact: contact?.trim() || null,
      note: note?.trim() || null,
      is_free: isFree,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const notifyTo = process.env.SUPPORT_NOTIFY_EMAIL ?? 'imseby@gmail.com'
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'marketing@aigate.app'
      await resend.emails.send({
        from: `AI GATE 客服協助 <${fromEmail}>`,
        to: [notifyTo],
        subject: `[CS 設定協助] ${ctx.user.email ?? ctx.user.id} 提出請求${isFree ? '' : `（需收費 $${priceUsd}）`}`,
        text: [
          `帳號 email：${ctx.user.email ?? '（未知）'}`,
          `owner_id：${ctx.ownerId}`,
          `產業：${industry}`,
          `聯絡方式：${contact || '（未留）'}`,
          `留言：${note || '（無）'}`,
          `計費：${isFree ? (isFirstEver ? '新會員首次免費' : '免費額度內') : `需收費 $${priceUsd} 美元（本月已送出 ${usedThisMonth + 1} 次）`}`,
        ].join('\n'),
      })
    } catch {
      // 通知失敗不影響請求已存檔，忽略即可
    }
  }

  return NextResponse.json({ ok: true, id: row.id, isFree, priceUsd: isFree ? 0 : priceUsd })
}
