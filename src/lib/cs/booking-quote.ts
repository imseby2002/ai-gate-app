import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeStayPrice, checkStayAvailability } from '@/lib/booking/pricing'

const DATE_HINT_RE = /[0-9]{1,2}\s*月|[0-9]{1,2}[\/\-][0-9]{1,2}|今天|明天|後天|這週|這周|下週|下周|週末|周末|假日|晚|宿|入住|出發/

const ExtractSchema = z.object({
  enough: z.boolean(),
  roomName: z.string().nullable().optional(),
  checkIn: z.string().nullable().optional(),
  checkOut: z.string().nullable().optional(),
  guests: z.number().nullable().optional(),
})

interface PropRow { id: string; name: string; name_aliases: string[] | null; max_guests: number | null }

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')

/**
 * 客服 bot 的房價報價，來源為訂房模組的權威定價（Plan A：每日價＋規則＋加人費）。
 * LLM 只負責抽房型名稱與日期；金額一律由 computeStayPrice 計算，確保與線上訂房一致。
 * bot 再依「促成工具箱」於客人猶豫時提供折扣/贈品，營造比 OTA 划算的感受。
 */
export async function buildBookingModuleQuote(
  supabase: SupabaseClient,
  userId: string,
  model: LanguageModel,
  conversationText: string,
  todayIso: string,
): Promise<string> {
  if (!DATE_HINT_RE.test(conversationText)) return ''

  const { data: props } = await supabase
    .from('properties').select('id, name, name_aliases, max_guests')
    .eq('user_id', userId).eq('status', 'active')
  const properties = (props ?? []) as PropRow[]
  if (!properties.length) return ''

  let extracted
  try {
    const { object } = await generateObject({
      model,
      schema: ExtractSchema,
      prompt: `今天是 ${todayIso}（Asia/Taipei）。請從客服對話抽取訂房參數，並將相對日期（如「這週末」「住兩晚」）換算為西元 YYYY-MM-DD。\n可選房型：${properties.map(p => p.name).join('、')}\n\n對話：\n${conversationText.slice(-1500)}\n\n規則：需要 roomName、checkIn、checkOut 才算足夠（enough=true）；缺漏或不確定則 enough=false。roomName 請對應上面房型原文。`,
    })
    extracted = object
  } catch {
    return ''
  }

  if (!extracted.enough || !extracted.roomName || !extracted.checkIn || !extracted.checkOut) return ''

  const target = norm(extracted.roomName)
  let prop = properties.find(p => norm(p.name) === target)
    ?? properties.find(p => (p.name_aliases ?? []).some(a => norm(a) === target))
    ?? properties.find(p => target && (norm(p.name).includes(target) || target.includes(norm(p.name))))
  if (!prop && properties.length === 1) prop = properties[0]
  if (!prop) return ''

  // 先查有沒有空房，不能只看算得出價格就當作有空——真實案例：房間當天已經有客人入住，
  // 客服 bot 卻照樣算出「優惠價」報給另一位客人，客人當場下單，結果根本沒有房可以給。
  const { available, conflictDates } = await checkStayAvailability(supabase, userId, prop.id, extracted.checkIn, extracted.checkOut)
  if (!available) {
    return `【系統查詢結果——權威資料，禁止自行判斷有空房】\n${prop.name}　${extracted.checkIn} ~ ${extracted.checkOut}\n這段期間已經被訂走，沒有空房（衝突日期：${conflictDates.join('、')}）。\n請誠實告知客人這個房型這段期間沒有空房，可以請客人換日期或換房型再問一次；絕對不可以自己算價格報給客人，也不可以說「目前有空房」「幫您保留」等話術。`
  }

  const quote = await computeStayPrice(supabase, userId, prop.id, extracted.checkIn, extracted.checkOut, extracted.guests ?? 1)
  if (!quote || quote.total <= 0) return ''

  const lines = quote.perNight.map(p => `  ${p.date} $${p.amount.toLocaleString()}`).join('\n')
  const extra = quote.extraGuestFee > 0 ? `\n  加人費 $${quote.extraGuestFee.toLocaleString()}` : ''
  const warn = quote.warnings.length ? `\n（${quote.warnings.join('；')}）` : ''
  return `【系統精算房價（權威，與線上訂房同價；請原文引用此金額，禁止自行加減或重算）】\n${prop.name}　${extracted.checkIn} ~ ${extracted.checkOut}（${quote.nights} 晚）\n${lines}${extra}\n── 總計 $${quote.total.toLocaleString()} ${quote.currency}\n（這是定價，客人若猶豫或嫌貴，才依「促成工具箱」提供折扣或贈品，讓客人感覺比訂房網划算；未猶豫前不主動降價。）${warn}`
}
