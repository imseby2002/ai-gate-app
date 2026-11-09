/** 預約簡訊提醒文案（前後端共用，不含伺服器依賴） */
const TZ = 'Asia/Taipei'
export const DEFAULT_REMINDER_TEMPLATE = '【{store}】{name} 您好，提醒您預約的「{service}」於 {time} 開始，敬請準時。改期請至 {url}'
export const REMINDER_HOURS_OPTIONS = [2, 3, 6, 12, 24, 48] as const

export function renderReminder(template: string | null | undefined, store: { name: string; slug: string }, appt: { customer_name: string; start_time: string; service?: { name?: string } | null }) {
  const time = new Date(appt.start_time).toLocaleString('zh-TW', { timeZone: TZ, month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  return (template?.trim() || DEFAULT_REMINDER_TEMPLATE)
    .replace(/\{store\}/g, store.name)
    .replace(/\{name\}/g, appt.customer_name || '貴賓')
    .replace(/\{service\}/g, appt.service?.name || '服務')
    .replace(/\{time\}/g, time)
    .replace(/\{url\}/g, `https://reserve.im-tourist.com/r/${store.slug}`)
}
