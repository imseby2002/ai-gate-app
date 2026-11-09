/**
 * 客服串接預約系統：客人在 LINE／WhatsApp 等平台問預約相關問題時，
 * 把店家的服務項目、近期空檔、線上預約連結，以及（訊息含手機號碼時）該客人的預約紀錄
 * 提供給 AI 客服參考。AI 不直接替客人建立或修改預約，一律引導到線上預約頁。
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAvailableSlots } from '@/lib/reserve/slots'
import type { ReserveAppointment, ReserveService, ReserveStaff, ReserveStore } from '@/lib/reserve/types'

const RESERVE_INTENT_RE = /預約|預定|約時間|時段|有空|空檔|改期|改時間|取消|幾點|營業|booking|appointment|reserve|schedule|đặt lịch|lịch hẹn|hẹn|giờ/i
const PHONE_RE = /(?<!\d)(?:\+?\d{1,3}[-\s]?)?0?9\d{2}[-\s]?\d{3}[-\s]?\d{3}(?!\d)/
const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']
const TZ = 'Asia/Taipei'

const STATUS_LABEL: Record<string, string> = {
  pending: '待確認', confirmed: '已確認', in_progress: '服務中', completed: '已完成', cancelled: '已取消', no_show: '未到',
}

const localDate = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: TZ })
const fmt = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: TZ, month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

/** 回傳要附加到 AI 客服 prompt 的預約資料段落；沒有預約系統或訊息與預約無關時回空字串 */
export async function reserveContextForCs(ownerId: string, message: string): Promise<string> {
  const phone = message.match(PHONE_RE)?.[0] ?? null
  if (!RESERVE_INTENT_RE.test(message) && !phone) return ''

  const admin = createAdminClient()
  const { data: storeRow } = await admin.from('reserve_stores').select('*').eq('user_id', ownerId).eq('is_active', true).maybeSingle()
  if (!storeRow) return ''
  const store = storeRow as ReserveStore

  const [{ data: services }, { data: staff }, { data: upcoming }] = await Promise.all([
    admin.from('reserve_services').select('*').eq('store_id', store.id).eq('is_active', true).order('sort_order'),
    admin.from('reserve_staff').select('*').eq('store_id', store.id).eq('is_active', true),
    admin.from('reserve_appointments').select('*, service:reserve_services(name), staff:reserve_staff(name)')
      .eq('store_id', store.id).gte('start_time', new Date(Date.now() - 86400_000).toISOString()).order('start_time').limit(500),
  ])
  const svcList = (services ?? []) as ReserveService[]
  const staffList = (staff ?? []) as ReserveStaff[]
  const appts = (upcoming ?? []) as (ReserveAppointment & { service?: { name?: string } | null; staff?: { name?: string } | null })[]

  const bookingUrl = `https://reserve.im-tourist.com/r/${store.slug}`
  const lines: string[] = [
    `\n\n【預約系統資料（${store.name}）】`,
    `線上預約連結：${bookingUrl}`,
    `服務項目：${svcList.slice(0, 15).map(s => `${s.name}（${s.duration_minutes} 分鐘，${s.sale_price ?? s.price} ${store.currency}）`).join('、') || '尚未建立'}`,
  ]

  // 近 3 天每個服務的前幾個空檔（最多 3 個服務），讓 AI 能回答「什麼時候有空」
  const avail: string[] = []
  for (const svc of svcList.slice(0, 3)) {
    for (let i = 0; i < 3; i++) {
      const d = new Date(Date.now() + i * 86400_000)
      const slots = computeAvailableSlots({ dateStr: localDate(d), store, service: svc, staffList, appointments: appts })
        .filter(s => s.available).slice(0, 6).map(s => s.time)
      if (slots.length) avail.push(`${svc.name}｜${localDate(d)}（週${DAY_NAMES[d.getDay()]}）：${slots.join('、')}`)
    }
  }
  lines.push(avail.length ? `近 3 天部分空檔：\n${avail.join('\n')}` : '近 3 天沒有查到空檔（可請客人到線上預約頁查看更多日期）')

  if (phone) {
    const suffix = phone.replace(/\D/g, '').slice(-9)
    const mine = appts.filter(a => (a.customer_phone ?? '').replace(/\D/g, '').endsWith(suffix))
    lines.push(mine.length
      ? `找到電話 ${phone} 的預約：\n${mine.slice(0, 5).map(a => `• ${fmt(a.start_time)} ${a.service?.name ?? ''}${a.staff?.name ? `（${a.staff.name}）` : ''}，狀態：${STATUS_LABEL[a.status] ?? a.status}，預約編號 ${a.appointment_no}`).join('\n')}`
      : `電話 ${phone} 查無近期預約紀錄。`)
  }

  lines.push(
    '【回覆規則】只能依上方資料回答；空檔只是參考，實際以預約頁為準。',
    'AI 不能替客人建立、修改或取消預約，也不能承諾保留時段；請提供線上預約連結讓客人自行預約或改期，取消或特殊需求請客人留言由店家處理。',
    '查無資料時照實說明，不可捏造預約紀錄、時段或價格。',
  )
  return lines.join('\n')
}
