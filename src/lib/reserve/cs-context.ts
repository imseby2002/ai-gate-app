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

type Appt = ReserveAppointment & { service?: { name?: string } | null; staff?: { name?: string } | null }

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
  // 多分店：取該帳號所有營業中的門市（最多 5 間）
  const { data: storeRows } = await admin.from('reserve_stores').select('*').eq('user_id', ownerId).eq('is_active', true)
    .order('created_at', { ascending: true }).limit(5)
  const stores = (storeRows ?? []) as ReserveStore[]
  if (!stores.length) return ''
  const multi = stores.length > 1
  // 分店多時每間少放一點，控制 prompt 長度
  const svcPerStore = multi ? 2 : 3
  const slotsPerDay = multi ? 4 : 6

  const lines: string[] = [multi ? `\n\n【預約系統資料（共 ${stores.length} 間分店）】` : `\n\n【預約系統資料（${stores[0].name}）】`]
  const allAppts: (Appt & { storeName: string })[] = []

  for (const store of stores) {
    const [{ data: services }, { data: staff }, { data: upcoming }] = await Promise.all([
      admin.from('reserve_services').select('*').eq('store_id', store.id).eq('is_active', true).order('sort_order'),
      admin.from('reserve_staff').select('*').eq('store_id', store.id).eq('is_active', true),
      admin.from('reserve_appointments').select('*, service:reserve_services(name), staff:reserve_staff(name)')
        .eq('store_id', store.id).gte('start_time', new Date(Date.now() - 86400_000).toISOString()).order('start_time').limit(500),
    ])
    const svcList = (services ?? []) as ReserveService[]
    const staffList = (staff ?? []) as ReserveStaff[]
    const appts = (upcoming ?? []) as Appt[]
    allAppts.push(...appts.map(a => ({ ...a, storeName: store.name })))

    if (multi) lines.push(`\n▍${store.name}${store.address ? `（${store.address}）` : ''}`)
    lines.push(
      `線上預約連結：https://reserve.im-tourist.com/r/${store.slug}`,
      `服務項目：${svcList.slice(0, 15).map(s => `${s.name}（${s.duration_minutes} 分鐘，${s.sale_price ?? s.price} ${store.currency}）`).join('、') || '尚未建立'}`,
    )

    // 近 3 天前幾個服務的部分空檔，讓 AI 能回答「什麼時候有空」
    const avail: string[] = []
    for (const svc of svcList.slice(0, svcPerStore)) {
      for (let i = 0; i < 3; i++) {
        const d = new Date(Date.now() + i * 86400_000)
        const slots = computeAvailableSlots({ dateStr: localDate(d), store, service: svc, staffList, appointments: appts })
          .filter(s => s.available).slice(0, slotsPerDay).map(s => s.time)
        if (slots.length) avail.push(`${svc.name}｜${localDate(d)}（週${DAY_NAMES[d.getDay()]}）：${slots.join('、')}`)
      }
    }
    lines.push(avail.length ? `近 3 天部分空檔：\n${avail.join('\n')}` : '近 3 天沒有查到空檔（可請客人到線上預約頁查看更多日期）')
  }

  if (phone) {
    const suffix = phone.replace(/\D/g, '').slice(-9)
    const mine = allAppts.filter(a => (a.customer_phone ?? '').replace(/\D/g, '').endsWith(suffix))
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
    lines.push(mine.length
      ? `找到電話 ${phone} 的預約：\n${mine.slice(0, 5).map(a => `• ${fmt(a.start_time)}${multi ? `【${a.storeName}】` : ''} ${a.service?.name ?? ''}${a.staff?.name ? `（${a.staff.name}）` : ''}，狀態：${STATUS_LABEL[a.status] ?? a.status}，預約編號 ${a.appointment_no}`).join('\n')}`
      : `電話 ${phone} 查無近期預約紀錄。`)
  }

  lines.push(
    '【回覆規則】只能依上方資料回答；空檔只是參考，實際以預約頁為準。有多間分店時先確認客人要去哪一間，再給該分店的預約連結。',
    'AI 不能替客人建立、修改或取消預約，也不能承諾保留時段；請提供線上預約連結讓客人自行預約或改期，取消或特殊需求請客人留言由店家處理。',
    '查無資料時照實說明，不可捏造預約紀錄、時段或價格。',
  )
  return lines.join('\n')
}

export interface GuestReservation {
  id: string
  appointmentNo: string
  startTime: string
  endTime: string
  service: string | null
  staff: string | null
  store: string | null
  status: string
  statusLabel: string
  customerName: string | null
}

/**
 * 收件匣客人資訊卡用：在預約系統（reserve.im-tourist.com）找這位客人最相關的一筆預約
 * （進行中或即將到來優先，否則最近一筆）。以手機號碼比對（客人核對過的手機、或對話中出現的手機）；
 * 沒有手機時退而用姓名比對，且只在恰好一位客人符合時採用，避免同名誤配。
 */
export async function findGuestReservation(
  ownerId: string,
  opts: { phones?: string[]; names?: Array<string | null | undefined> },
): Promise<GuestReservation | null> {
  const admin = createAdminClient()
  const { data: storeRows } = await admin.from('reserve_stores').select('id, name').eq('user_id', ownerId).limit(20)
  const stores = (storeRows ?? []) as Array<{ id: string; name: string }>
  if (!stores.length) return null
  const storeName = new Map(stores.map(s => [s.id, s.name]))

  const { data } = await admin.from('reserve_appointments')
    .select('id, appointment_no, store_id, customer_name, customer_phone, start_time, end_time, status, service:reserve_services(name), staff:reserve_staff(name)')
    .in('store_id', stores.map(s => s.id))
    .gte('start_time', new Date(Date.now() - 30 * 86400_000).toISOString())
    .order('start_time', { ascending: true }).limit(1000)
  type Row = { id: string; appointment_no: string; store_id: string; customer_name: string | null; customer_phone: string | null; start_time: string; end_time: string; status: string; service: { name?: string } | null; staff: { name?: string } | null }
  const rows = (data ?? []) as unknown as Row[]
  if (!rows.length) return null

  const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '')
  const suffixes = [...new Set((opts.phones ?? []).map(p => digits(p).slice(-9)).filter(s => s.length >= 8))]
  let mine = suffixes.length ? rows.filter(r => suffixes.some(s => digits(r.customer_phone).endsWith(s))) : []
  if (!mine.length) {
    const norm = (s?: string | null) => (s ?? '').toLowerCase().replace(/\s+/g, '')
    for (const n of opts.names ?? []) {
      const want = norm(n)
      if (want.length < 2) continue
      const ms = rows.filter(r => norm(r.customer_name) === want)
      if (ms.length && new Set(ms.map(r => digits(r.customer_phone))).size === 1) { mine = ms; break }
    }
  }
  if (!mine.length) return null

  const now = Date.now()
  const active = mine.filter(r => r.status !== 'cancelled' && Date.parse(r.end_time) >= now - 3600_000)
  const hit = active[0] ?? mine[mine.length - 1]
  return {
    id: hit.id, appointmentNo: hit.appointment_no, startTime: hit.start_time, endTime: hit.end_time,
    service: hit.service?.name ?? null, staff: hit.staff?.name ?? null, store: storeName.get(hit.store_id) ?? null,
    status: hit.status, statusLabel: STATUS_LABEL[hit.status] ?? hit.status, customerName: hit.customer_name,
  }
}

/** 從客人訊息中擷取手機號碼（給 findGuestReservation 比對用） */
export function extractPhones(texts: Array<string | null | undefined>): string[] {
  const re = new RegExp(PHONE_RE.source, 'g')
  return [...new Set(texts.flatMap(t => (t ?? '').match(re) ?? []))]
}
