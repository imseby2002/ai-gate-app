// 官網訂房付款方式（前後端共用）
export type PaymentMethod = 'on_arrival' | 'transfer' | 'card'

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  on_arrival: '到店付款',
  transfer: '銀行轉帳',
  card: '信用卡',
}

export interface BankTransferInfo {
  bank_name?: string | null
  bank_code?: string | null
  account_name?: string | null
  account_no?: string | null
  deadline_hours?: number | null
  note?: string | null
}

/** 轉帳資訊是否填齊（至少要有銀行代碼或名稱，以及帳號） */
export function bankInfoComplete(b?: BankTransferInfo | null): boolean {
  return !!(b && (b.bank_code || b.bank_name) && b.account_no)
}

/** 民宿開放、且條件齊全的付款方式（轉帳需填好帳號才算開放） */
export function availablePaymentMethods(methods: string[] | null | undefined, bank?: BankTransferInfo | null): PaymentMethod[] {
  const list = (methods?.length ? methods : ['on_arrival']).filter((m): m is PaymentMethod =>
    m === 'on_arrival' || (m === 'transfer' && bankInfoComplete(bank)))
  return list.length ? list : ['on_arrival']
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

/** 確認信用的付款說明區塊 */
export function paymentBlockHtml(method: string | null | undefined, bank: BankTransferInfo | null | undefined, total: number | null, code?: string | null): string {
  if (method === 'transfer' && bankInfoComplete(bank)) {
    const rows: [string, string][] = [
      ['銀行', `${bank!.bank_name ?? ''}${bank!.bank_code ? `（${bank!.bank_code}）` : ''}`],
      ['帳號', bank!.account_no ?? ''],
      ...(bank!.account_name ? [['戶名', bank!.account_name] as [string, string]] : []),
      ...(total != null ? [['匯款金額', `NT$ ${Number(total).toLocaleString()}`] as [string, string]] : []),
      ...(bank!.deadline_hours ? [['匯款期限', `訂房後 ${bank!.deadline_hours} 小時內`] as [string, string]] : []),
    ]
    return `<div style="margin:16px 0;padding:12px 16px;background:#eff6ff;border-left:3px solid #3b82f6">
<p style="margin:0 0 8px;font-weight:600">付款方式：銀行轉帳</p>
<table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#64748b">${k}</td><td style="padding:2px 0;font-weight:600">${esc(v)}</td></tr>`).join('')}</table>
<p style="margin:8px 0 0;font-size:13px;color:#475569">匯款後請回覆此信或聯絡我們告知帳號末五碼${code ? `（訂房確認碼 ${esc(code)}）` : ''}。${bank!.note ? `<br>${esc(bank!.note)}` : ''}</p>
</div>`
  }
  return `<p style="margin:16px 0">付款方式：<strong>到店付款</strong>（入住時付款）</p>`
}
