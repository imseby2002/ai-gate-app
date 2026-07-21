import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBnbContext } from '@/lib/bnb/context'
import { getCsEntitlements, CS_FEATURE_REQUEST_PRICING } from '@/lib/cs/entitlements'
import { Resend } from 'resend'

const HARD_CAP_PER_MONTH = 10
const VALID_TYPES = ['feature', 'feedback']

// POST /api/marketing/cs-support-request
// 「客製功能需求」與「問題反映」的送出端點。與 cs-setup-request（找人幫我設定）分開。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, contact = '', note = '' } = await req.json()
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  if (!note?.trim()) return NextResponse.json({ error: '請填寫需求說明' }, { status: 400 })

  // 用 admin client 查方案與計數：RLS 只讓使用者看到自己送出的請求，
  // 但額度與計價要以民宿（owner_id）為單位，涵蓋所有協作者送出的請求。
  const admin = createAdminClient()

  const nowTaipei = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const monthStart = `${nowTaipei.getFullYear()}-${String(nowTaipei.getMonth() + 1).padStart(2, '0')}-01T00:00:00+08:00`
  const { count } = await admin
    .from('cs_support_requests')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ctx.ownerId)
    .gte('created_at', monthStart)

  if ((count ?? 0) >= HARD_CAP_PER_MONTH) {
    return NextResponse.json({ error: '本月申請次數過多，請聯繫我們確認狀況。' }, { status: 429 })
  }

  const { plan } = await getCsEntitlements(admin, ctx.ownerId)
  const priceUsd = type === 'feature' ? CS_FEATURE_REQUEST_PRICING.basicPriceUsdByPlan[plan] : null

  const { data: row, error } = await supabase
    .from('cs_support_requests')
    .insert({
      user_id: ctx.user.id,
      owner_id: ctx.ownerId,
      type,
      contact: contact?.trim() || null,
      note: note.trim(),
      plan_at_request: plan,
      price_usd: priceUsd,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const notifyTo = process.env.SUPPORT_NOTIFY_EMAIL ?? 'imseby@gmail.com'
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'marketing@aigate.app'
      const typeLabel = type === 'feature' ? '客製功能需求' : '問題反映'
      await resend.emails.send({
        from: `AI GATE 客服 <${fromEmail}>`,
        to: [notifyTo],
        subject: `[CS ${typeLabel}] ${ctx.user.email ?? ctx.user.id}${priceUsd != null ? `（基礎客製 $${priceUsd}/次）` : ''}`,
        text: [
          `類型：${typeLabel}`,
          `帳號 email：${ctx.user.email ?? '（未知）'}`,
          `owner_id：${ctx.ownerId}`,
          `方案：${plan}`,
          `聯絡方式：${contact || '（未留）'}`,
          `內容：${note}`,
          ...(priceUsd != null ? [`基礎客製參考價：$${priceUsd} 美元/次（需審核，複雜功能另議建置費+月維護費）`] : []),
        ].join('\n'),
      })
    } catch {
      // 通知失敗不影響請求已存檔，忽略即可
    }
  }

  return NextResponse.json({ ok: true, id: row.id, priceUsd })
}
