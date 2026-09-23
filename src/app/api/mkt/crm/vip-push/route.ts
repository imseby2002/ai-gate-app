import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() {
  return await getUnitContextAny(['mkt', 'marketing'])
}

export async function POST(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const b = await req.json().catch(() => ({}))
  const productName = String(b.product_name ?? '').trim()
  const discountType = String(b.discount_type ?? 'early_bird')
  const vipEndDate = String(b.vip_end_date ?? '')
  const customNote = String(b.custom_note ?? '')

  if (!productName) return NextResponse.json({ error: '請提供新品名稱' }, { status: 400 })

  // 取得 VIP 與 VVIP 名單數量
  const { data: vipMembers } = await c.admin
    .from('crm_customers')
    .select('id, name, phone, tier')
    .eq('owner_id', c.ownerId)
    .in('tier', ['vip', 'vvip'])

  const count = vipMembers?.length ?? 0

  const deadlineText = vipEndDate ? `即日起至 ${vipEndDate}` : '限時專享'

  const messageTemplates = {
    line: `👑【尊爵 VIP 搶先試飲邀請】\n親愛的貴賓您好！研發團隊耗時數月打造的全新力作【${productName}】正式問世！\n我們特別保留給最尊榮的 VIP 會員獨家優先品嚐（${deadlineText}）。\n門市點單出示此訊息或報手機號碼，即可享專屬早鳥尊榮禮遇！\n${customNote ? `\n備註：${customNote}` : ''}\n期待您的品鑑與回饋！`,
    sms: `【品牌VIP搶先嚐】尊貴會員您好，新品「${productName}」VIP專屬試飲開始（${deadlineText}），請至門市報手機號碼搶先品嚐！`,
    zalo: `👑 Kính gửi Quý khách VIP! Sản phẩm mới 【${productName}】 đã chính thức ra mắt dành riêng cho thành viên VIP trải nghiệm sớm (${deadlineText}). Kính mời Quý khách ghé cửa hàng để thưởng thức ngay hôm nay!`
  }

  return NextResponse.json({
    ok: true,
    recipientCount: count,
    members: vipMembers ?? [],
    templates: messageTemplates,
  })
}
