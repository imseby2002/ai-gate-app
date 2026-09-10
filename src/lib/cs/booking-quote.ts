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

  if (quote.hasPromotionalDiscount) {
    const promoNames = quote.promotionsApplied.join('、') || '早鳥/晚鳥專案特惠'
    return `【系統精算房價（權威資料，請原文引用此金額，禁止自行加減或重算）】
房型：${prop.name}
日期：${extracted.checkIn} ~ ${extracted.checkOut}（${quote.nights} 晚）
官方原價（定價／牌價）：$${quote.baseTotal.toLocaleString()} ${quote.currency}
專案特惠價：$${quote.total.toLocaleString()} ${quote.currency}（已享 ${promoNames}）
每日特惠明細：
${lines}${extra}
── 實收總計：$${quote.total.toLocaleString()} ${quote.currency}

【極重要：優惠與補助互斥規定（最高原則，嚴禁重複疊加折扣）】
1. 本民宿所有優惠專案（早鳥優惠、晚鳥特惠、促成折扣）與各類政府補助（國旅補助、振興抵用券等）採【獨立計算，二擇一使用，嚴禁重複疊加折扣】！
2. 若客人要申請使用「國旅補助」：房價一律必須以【官方原價 $${quote.baseTotal.toLocaleString()} 元】計算，入住當天憑身分證正本由管家現場核銷折抵，【絕對嚴禁】在專案特惠價 $${quote.total.toLocaleString()} 上再重複扣除補助（例如不可扣成更低的雙重折扣價）！
3. 若客人選擇享有【${promoNames}】：直接享有專案特惠價 $${quote.total.toLocaleString()} 元，但【恕無法再申請國旅補助】或折抵其他專案！
4. 當客人詢問價格且提到國旅補助、或詢問早鳥等優惠方案時，請務必主動禮貌說明「優惠與補助恕無法重複併用，需二擇一」，並清楚列出兩種方案供客人評估何者最划算（例如：「方案 A：使用國旅補助，依原價 $${quote.baseTotal.toLocaleString()} 折抵補助款」vs「方案 B：享有 ${promoNames} 特惠價 $${quote.total.toLocaleString()}」，由客人決定）！${warn}`
  }

  return `【系統精算房價（權威，與線上訂房同價；請原文引用此金額，禁止自行加減或重算）】
房型：${prop.name}
日期：${extracted.checkIn} ~ ${extracted.checkOut}（${quote.nights} 晚）
${lines}${extra}
── 總計 $${quote.total.toLocaleString()} ${quote.currency}
（這是官方牌價／原價。若客人欲申請「國旅補助」，以此原價為準，入住時憑身分證正本由管家現場核銷折抵。客人若猶豫或嫌貴，才依「促成工具箱」提供折扣或贈品，促成折扣恕不與國旅補助重複併用；未猶豫前不主動降價。）${warn}`
}
