import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'
import { computeAccommodation, computeTour, formatQuote, type PricingConfig } from './pricing'

// A date appears in the conversation → worth attempting a quote
const DATE_HINT_RE = /[0-9]{1,2}\s*月|[0-9]{1,2}[\/\-][0-9]{1,2}|今天|明天|後天|這週|這周|下週|下周|週末|周末|假日|晚|宿|入住|出發/

const ExtractSchema = z.object({
  enough: z.boolean(),
  roomName: z.string().nullable().optional(),
  checkIn: z.string().nullable().optional(),
  checkOut: z.string().nullable().optional(),
  guests: z.number().nullable().optional(),
  date: z.string().nullable().optional(),
  items: z.array(z.object({ label: z.string(), qty: z.number() })).nullable().optional(),
  packages: z.array(z.object({ name: z.string(), qty: z.number() })).nullable().optional(),
})

/**
 * Let the LLM extract structured parameters from the conversation, then compute the
 * total deterministically in code. Returns an authoritative quote block to inject into
 * the system prompt, or '' when there isn't enough information to quote.
 */
export async function buildDeterministicQuote(
  model: LanguageModel,
  config: PricingConfig,
  conversationText: string,
  todayIso: string,
): Promise<string> {
  if (config.productType !== 'accommodation' && config.productType !== 'tour') return ''
  if (!DATE_HINT_RE.test(conversationText)) return ''  // no date context yet → skip the extra call

  const roomNames = (config.rooms ?? []).map(r => r.name)
  const segNames = (config.segments ?? []).map(s => s.label)
  const pkgNames = (config.packages ?? []).map(p => p.name)

  try {
    const { object } = await generateObject({
      model,
      schema: ExtractSchema,
      prompt: `今天是 ${todayIso}（Asia/Taipei）。以下是客服對話，請抽取訂價所需參數，並將所有相對日期（如「這週末」「下週五」「住兩晚」）換算為西元 YYYY-MM-DD。\n\n商品類型：${config.productType}\n${roomNames.length ? `可選房型：${roomNames.join('、')}\n` : ''}${segNames.length ? `可選票種：${segNames.join('、')}\n` : ''}${pkgNames.length ? `可選套餐：${pkgNames.join('、')}\n` : ''}\n對話：\n${conversationText.slice(-1500)}\n\n規則：\n- 住宿：需要 roomName、checkIn、checkOut、guests 才算足夠。\n- 行程：需要 date 與 items（各票種人數）才算足夠。\n- 任一必要欄位缺漏或不確定時，enough=false。\n- 房型／票種／套餐名稱請對應上面提供的選項原文。`,
    })

    if (!object.enough) return ''

    if (config.productType === 'accommodation') {
      if (!object.roomName || !object.checkIn || !object.checkOut) return ''
      const r = computeAccommodation(config, {
        roomName: object.roomName,
        checkIn: object.checkIn,
        checkOut: object.checkOut,
        guests: object.guests ?? 1,
      })
      return r ? formatQuote(r) : ''
    }

    // tour
    if (!object.date || !object.items?.length) return ''
    const r = computeTour(config, {
      date: object.date,
      items: object.items.map(i => ({ label: i.label, qty: i.qty })),
      packages: (object.packages ?? []).map(p => ({ name: p.name, qty: p.qty })),
    })
    return r ? formatQuote(r) : ''
  } catch {
    return ''
  }
}
