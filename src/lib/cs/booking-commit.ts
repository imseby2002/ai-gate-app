// 客服訂房寫單：客人在對話中確認訂房清單後，依民宿主在訂房系統設定的「客服訂房模式」
//   manual → 建立待確認的官網訂房申請（先佔住房間），由真人客服最後回覆成功與否
//   ai     → 建立申請後直接轉成正式訂單（待付款，booking_orders.is_paid = false）
// 寫入一律走 create_public_booking（advisory lock + 撞期檢查），與官網訂房共用，避免重複訂到同一間。
import { generateText, type LanguageModel } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeStayPrice } from '@/lib/booking/pricing'
import { confirmPublicBooking } from '@/lib/booking/public-booking-confirm'
import { BOOKING_HUMAN_CONFIRM_NOTICE } from '@/lib/cs/booking-prompt'

// none＝未串接訂房系統（沒有建立任何房型，例如非住宿業）：不寫單、不附真人客服提示。
export type CsBookingMode = 'manual' | 'ai' | 'none'

export async function getCsBookingMode(supabase: SupabaseClient, userId: string): Promise<CsBookingMode> {
  const [{ count }, { data }] = await Promise.all([
    supabase.from('properties').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('bnb_profiles').select('cs_booking_mode').eq('user_id', userId).maybeSingle(),
  ])
  if (!count) return 'none'
  return data?.cs_booking_mode === 'ai' ? 'ai' : 'manual'
}

interface ExtractedBooking {
  property_name: string | null
  check_in: string | null
  check_out: string | null
  num_guests: number | null
  guest_name: string | null
  guest_phone: string | null
  guest_email: string | null
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function extractBooking(
  convo: { role: string; content: string }[], propertyNames: string[], model: LanguageModel,
): Promise<ExtractedBooking | null> {
  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  const text = convo.slice(-30).map(m => `${m.role === 'user' ? '客人' : '客服'}：${m.content}`).join('\n').slice(-8000)
  try {
    const { text: out } = await generateText({
      model,
      messages: [{
        role: 'user',
        content: `以下是民宿客服與客人的訂房對話，客人剛確認了訂房資料。今天是 ${todayIso}（台灣時間）。
可選房型（property_name 必須完全等於其中一個，對不上就填 null）：
${propertyNames.map(n => `- ${n}`).join('\n')}

請只根據對話中客人明確提供或確認的內容，回傳 JSON：
{"property_name": 字串或null, "check_in": "YYYY-MM-DD"或null, "check_out": "YYYY-MM-DD"或null, "num_guests": 數字或null, "guest_name": 字串或null, "guest_phone": 字串或null, "guest_email": 字串或null}
日期沒寫年份時，取今天之後最近的那一天。只說住幾晚時，check_out = check_in + 晚數。沒提到的欄位填 null，不要猜測。只回傳 JSON。

對話：
${text}`,
      }],
    })
    const match = out.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0]) as ExtractedBooking
  } catch {
    return null
  }
}

// 回傳要附加到系統提示詞的段落；空字串表示不是可寫入的訂房（例如非房型行程、資料不足），維持原本流程。
export async function commitCsRoomBooking(
  supabase: SupabaseClient,
  userId: string,
  convo: { role: string; content: string }[],
  model: LanguageModel,
  mode: CsBookingMode,
  sourceLabel: string,
): Promise<string> {
  if (mode === 'none') return ''
  const { data: properties } = await supabase.from('properties').select('id, name').eq('user_id', userId)
  const props = (properties ?? []).filter(p => p.name)
  if (!props.length) return ''

  const ex = await extractBooking(convo, props.map(p => p.name as string), model)
  if (!ex) return ''
  const prop = props.find(p => p.name === ex.property_name)
  const name = ex.guest_name?.trim()
  const phone = ex.guest_phone?.trim() || null
  const email = ex.guest_email?.trim() || null
  if (!prop || !name || (!phone && !email)) return ''
  if (!ex.check_in || !ex.check_out || !ISO_DATE_RE.test(ex.check_in) || !ISO_DATE_RE.test(ex.check_out) || ex.check_out <= ex.check_in) return ''
  const guests = Number(ex.num_guests) > 0 ? Number(ex.num_guests) : 1

  const manualNotice = `回覆最後必須加上一句：「${BOOKING_HUMAN_CONFIRM_NOTICE}」，禁止說訂房已成功。`

  // 客人重複回「正確」時，同一筆申請已寫過 → 不重寫（否則會被自己的申請擋成撞期）
  const { data: dup } = await supabase.from('public_bookings')
    .select('id, confirmation_code, status')
    .eq('host_user_id', userId).eq('property_id', prop.id)
    .eq('check_in', ex.check_in).eq('check_out', ex.check_out).eq('guest_name', name)
    .in('status', ['pending', 'confirmed']).limit(1)
  if (dup?.length) {
    return `\n\n【系統：這筆訂房先前已寫入訂房系統（確認碼 ${dup[0].confirmation_code}），不要重複建立】${mode === 'manual' ? manualNotice : ''}`
  }

  const quote = await computeStayPrice(supabase, userId, prop.id, ex.check_in, ex.check_out, guests, 0)

  const { data: booking, error } = await supabase.rpc('create_public_booking', {
    p_host_user_id: userId,
    p_property_id: prop.id,
    p_check_in: ex.check_in,
    p_check_out: ex.check_out,
    p_guest_name: name,
    p_guest_email: email ?? '',   // 欄位 NOT NULL；客服管道可只留電話
    p_guest_phone: phone,
    p_num_guests: guests,
    p_total_price: quote?.total ?? null,
    p_promo_code: null,
    p_promo_discount: null,
    p_notes: `[客服${mode === 'ai' ? 'AI 訂房' : '訂房待人工確認'}] ${sourceLabel}`,
  })

  if (error) {
    if (error.message?.includes('DATE_CONFLICT')) {
      return `\n\n【系統：寫入訂房系統失敗——「${prop.name}」${ex.check_in}～${ex.check_out} 已被預訂或關房】你這則回覆必須向客人致歉說明該房型這段日期已被訂走，禁止說訂房成功，並詢問是否改其他房型或日期。`
    }
    return `\n\n【系統：訂房系統暫時無法寫入】${manualNotice}`
  }

  if (mode === 'ai') {
    const result = await confirmPublicBooking(supabase, userId, booking.id)
    if (!result.ok) {
      return `\n\n【系統：已建立待確認訂房申請（確認碼 ${booking.confirmation_code}），但轉正式訂單失敗】${manualNotice}`
    }
    return `\n\n【系統：訂單已寫入訂房系統——${prop.name}，${ex.check_in}～${ex.check_out}，${guests} 位，確認碼 ${booking.confirmation_code}，狀態：待付款】你這則回覆要告知客人訂房已成立並提供確認碼，提醒依先前的付款資訊完成付款。`
  }
  return `\n\n【系統：已建立待確認訂房申請並先為客人保留房間（確認碼 ${booking.confirmation_code}）】你這則回覆要告知客人已收到訂房並提供確認碼。${manualNotice}`
}
