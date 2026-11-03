import { getCoupons, saveCoupons, EsimCoupon } from './coupons'

// CS 客服把 eSIM 優惠券當贈品：eSIM 後台在範本券填「CS 客服贈品授權帳號 Email」，
// 該帳號的客服 AI 送出這項贈品時，系統依範本複製出一組客人專屬、只能用一次的兌換碼。

export const ESIM_SHOP_URL = 'https://esim.im-tourist.com'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode(length: number) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

function isAllowed(c: EsimCoupon, email: string) {
  return c.is_active && !c.cs_gift_source && (c.cs_gift_emails ?? []).includes(email.trim().toLowerCase())
}

/** 這個帳號可以拿來當 CS 贈品的 eSIM 範本券 */
export async function listCsGiftCoupons(email: string): Promise<Array<Pick<EsimCoupon, 'code' | 'name'>>> {
  if (!email) return []
  const coupons = await getCoupons()
  return coupons.filter(c => isAllowed(c, email)).map(c => ({ code: c.code, name: c.name }))
}

/** 依範本券複製一組只能用一次的兌換碼；未授權或範本已停用回傳 null */
export async function issueCsGiftCode(email: string, templateCode: string, note: string): Promise<string | null> {
  if (!email || !templateCode) return null
  const coupons = await getCoupons()
  const tpl = coupons.find(c => c.code.toUpperCase() === templateCode.trim().toUpperCase())
  if (!tpl || !isAllowed(tpl, email)) return null
  const existing = new Set(coupons.map(c => c.code.toUpperCase()))
  let code = ''
  for (let i = 0; i < 20 && (!code || existing.has(code)); i++) code = `CS${randomCode(8)}`
  if (existing.has(code)) return null
  const issued: EsimCoupon = {
    ...tpl,
    id: `coupon_cs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    code,
    name: `${tpl.name}（CS 贈品${note ? `｜${note.slice(0, 40)}` : ''}）`,
    usage_count: 0,
    max_usage_count: 1,
    max_uses_per_customer: 1,
    max_uses_per_day: undefined,
    cs_gift_emails: undefined,
    cs_gift_source: tpl.code,
    created_at: new Date().toISOString(),
  }
  const ok = await saveCoupons([issued, ...coupons])
  return ok ? code : null
}
