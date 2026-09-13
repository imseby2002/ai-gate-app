import { isSafeWebhookUrl } from '@/lib/ssrf'

// 工單通知的多管道發送：LINE Messaging push / Telegram / 通用 webhook。
// 供 cs-chat（測試分頁的人工客服請求）與 cs-webhook（正式頻道的六種工單）共用
// 這個「怎麼把一則通知送到三種管道」的機制，避免各自維護、走鐘。
//
// 兩處先前各自維護一份：webhook 版本額外處理了「客人是誰＋直接回覆的深連結」，
// 以及 Telegram 的 HTML 格式、inline 按鈕、關閉連結預覽卡片（真實案例修正過的
// bug）、HTML 解析失敗時退回純文字。這些屬於「有真實客人時才有意義」的內容
// 組裝邏輯，留在各自呼叫端；這裡只抽出真正共用、行為必須一致的發送機制本身。
export type NotifyWebhook = { type: 'line_messaging' | 'webhook' | 'telegram'; value: string; target?: string }

export interface TicketNotifyPayload {
  /** LINE push 與通用 webhook 的純文字內容。 */
  text: string
  /** Telegram 專用的 HTML 格式內容；省略時 Telegram 也送 `text`（純文字）。 */
  telegramHtml?: string
  /** Telegram inline 按鈕（例如「點此開啟對話回覆」）。 */
  telegramReplyMarkup?: { inline_keyboard: Array<Array<{ text: string; url: string }>> }
  /** 合併進通用 webhook POST body（`message` 欄位之外的其他欄位）。 */
  webhookExtra?: Record<string, unknown>
}

export async function sendTicketNotification(notifyWebhooks: NotifyWebhook[], payload: TicketNotifyPayload): Promise<void> {
  if (!notifyWebhooks?.length) return
  await Promise.allSettled(notifyWebhooks.filter(wh => wh.value?.trim()).map(async wh => {
    if (wh.type === 'line_messaging') {
      if (!wh.target?.trim()) return
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${wh.value.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: wh.target.trim(), messages: [{ type: 'text', text: payload.text }] }),
      })
      return
    }

    if (wh.type === 'telegram') {
      if (!wh.target?.trim()) return
      const usingHtml = !!payload.telegramHtml
      const res = await fetch(`https://api.telegram.org/bot${wh.value.trim()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: wh.target.trim(),
          text: payload.telegramHtml ?? payload.text,
          ...(usingHtml ? { parse_mode: 'HTML' } : {}),
          ...(payload.telegramReplyMarkup ? { reply_markup: payload.telegramReplyMarkup } : {}),
          // 訊息含 <a href> 連結時，Telegram 預設會在下方另外貼一張抓取自該網址的
          // 預覽卡片，卡片上照樣顯示完整長網址——關掉預覽卡片，只留文字裡的短連結
          // 跟按鈕（沒有連結時這個選項無影響）。
          link_preview_options: { is_disabled: true },
        }),
      })
      if (!res.ok && usingHtml) {
        // HTML 解析失敗時退回純文字，僅以按鈕（若有）提供連結，避免完全收不到通知
        await fetch(`https://api.telegram.org/bot${wh.value.trim()}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: wh.target.trim(),
            text: payload.text,
            ...(payload.telegramReplyMarkup ? { reply_markup: payload.telegramReplyMarkup } : {}),
          }),
        })
      }
      return
    }

    if (!isSafeWebhookUrl(wh.value.trim())) return  // block SSRF to internal hosts
    await fetch(wh.value.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: payload.text, ...(payload.webhookExtra ?? {}) }),
    })
  }))
}
