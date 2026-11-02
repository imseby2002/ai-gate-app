import { Resend } from 'resend'
import { getEsimSettings, saveEsimSettings, getEsimOrderByNo } from './db'
import { getCoupons } from './coupons'

export interface CouponNotifySettings {
  enabled: boolean
  emails: string[] // 收件人（管理員）
}

const DEFAULT_NOTIFY: CouponNotifySettings = { enabled: false, emails: [] }

export async function getCouponNotifySettings(): Promise<CouponNotifySettings> {
  try {
    const s = await getEsimSettings<CouponNotifySettings>('coupon_notify', DEFAULT_NOTIFY)
    return {
      enabled: !!s?.enabled,
      emails: Array.isArray(s?.emails) ? s.emails.filter(e => typeof e === 'string' && e.includes('@')) : [],
    }
  } catch {
    return DEFAULT_NOTIFY
  }
}

export async function saveCouponNotifySettings(s: CouponNotifySettings): Promise<boolean> {
  return await saveEsimSettings('coupon_notify', s, 'eSIM 優惠券使用通知設定')
}

function esc(v: unknown) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/**
 * 訂單付款成功且有使用優惠券時，寄通知信給管理員。失敗不影響訂單流程。
 */
export async function sendCouponUsedNotification(orderNo: string): Promise<void> {
  try {
    const settings = await getCouponNotifySettings()
    if (!settings.enabled || settings.emails.length === 0) return

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.log('[CouponNotify] RESEND_API_KEY not configured, skipping.')
      return
    }

    const order = await getEsimOrderByNo(orderNo)
    const code = order?.metadata?.coupon_code
    if (!order || !code) return

    const coupon = (await getCoupons()).find(c => c.code.toUpperCase() === String(code).toUpperCase())
    const usage = coupon
      ? `${coupon.usage_count || 0}${coupon.max_usage_count ? ` / ${coupon.max_usage_count}` : ''} 次`
      : '-'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://esim.im-tourist.com'

    const rows: [string, string][] = [
      ['優惠代碼', String(code)],
      ['活動名稱', order.metadata?.coupon_name || coupon?.name || '-'],
      ['折抵金額', `NT$ ${order.metadata?.coupon_discount_twd ?? 0}`],
      ['訂單編號', order.order_no],
      ['顧客', `${order.customer_name || '-'}（${order.customer_email}）`],
      ['方案', `${order.country_name} ${order.data_amount} ${order.day}天 x${order.quantity}`],
      ['原價', `NT$ ${order.metadata?.subtotal_price_twd ?? order.total_price_twd}`],
      ['實付', `NT$ ${order.total_price_twd}`],
      ['此券已兌換', usage],
    ]

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;max-width:560px;margin:0 auto;">
        <h2 style="margin:0 0 12px;">🎟️ 優惠券「${esc(code)}」已被使用</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${rows.map(([k, v]) => `<tr><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;width:32%;">${esc(k)}</td><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:600;">${esc(v)}</td></tr>`).join('')}
        </table>
        <p style="margin-top:16px;"><a href="${appUrl}/esim/admin" style="color:#2563eb;">前往 eSIM 後台</a></p>
      </div>
    `

    const resend = new Resend(apiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'esim@im-tourist.com'
    const { error } = await resend.emails.send({
      from: `imTourist eSIM <${fromEmail}>`,
      to: settings.emails,
      subject: `【優惠券使用通知】${code} ・ 訂單 ${order.order_no}`,
      html,
    })
    if (error) console.error('[CouponNotify] Resend error:', error)
  } catch (err) {
    console.warn('[CouponNotify] Failed to send notification:', err)
  }
}
