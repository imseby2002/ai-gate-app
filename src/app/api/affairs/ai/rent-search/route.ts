import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { generateWithSearch, parseJsonObject, replyLanguage } from '@/lib/affairs/ai'

export const maxDuration = 300

// 區域租金自動搜尋：找該區店面出租行情，並分析近年漲跌；結果由前端選擇是否存入租金評比。
export async function POST(req: NextRequest) {
  const ctx = await getUnitContext('affairs')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })

  const body = await req.json().catch(() => ({}))
  const region = String(body.region ?? '').trim().slice(0, 200)
  const address = String(body.address ?? '').trim().slice(0, 300)
  const subtype = String(body.subtype ?? '').trim().slice(0, 50)
  if (!region && !address) return NextResponse.json({ error: '請先填寫地址或區域' }, { status: 400 })

  const { data: history } = await ctx.admin.from('affair_rent_benchmarks')
    .select('address, area_sqm, monthly_rent, currency, observed_at, source')
    .eq('owner_id', ctx.ownerId).eq('region', region).order('observed_at', { ascending: true }).limit(100)

  const lang = await replyLanguage()
  const system = `你是商用不動產租賃顧問。必須先用 web_search 查最新的店面出租刊登與租金行情報導，再輸出結果。
規則：
- 用${lang}撰寫文字欄位。
- listings 只列真的查到的刊登或報導，附原始網址；查不到就回傳空陣列，不要編造。
- 只回傳一個 JSON 物件，不要 markdown。`

  const prompt = `區域：${region || '（未填）'}
地址：${address || '（未填）'}
店面類型：${subtype || '一般店面'}
公司已記錄的歷史租金（供漲跌比較）：${JSON.stringify(history ?? [])}

回傳 JSON：
{
  "summary": "該區店面租金行情總結",
  "typical_rent_per_sqm": 數字或 null,
  "currency": "",
  "trend": "up" | "flat" | "down" | "unknown",
  "trend_note": "近 1–3 年漲跌幅與原因（附依據）",
  "negotiation_tips": [""],
  "listings": [{ "address": "", "area_sqm": 數字或 null, "monthly_rent": 數字, "currency": "", "observed_at": "YYYY-MM-DD", "source_url": "", "note": "" }]
}`

  try {
    const r = await generateWithSearch({ system, messages: [{ role: 'user', content: prompt }], maxSearches: 6, maxOutputTokens: 4000 })
    const parsed = parseJsonObject<Record<string, unknown>>(r.text)
    if (!parsed) return NextResponse.json({ error: 'AI 回傳格式錯誤' }, { status: 502 })
    const listings = (Array.isArray(parsed.listings) ? parsed.listings : [])
      .filter((l: { monthly_rent?: unknown }) => Number(l?.monthly_rent) > 0)
    return NextResponse.json({ ...parsed, listings, sources: r.sources })
  } catch (e) {
    console.error('[affairs/ai/rent-search]', e)
    return NextResponse.json({ error: e instanceof Error && e.message === 'AI 金鑰未設定' ? e.message : 'AI 服務暫時無法使用，請稍後再試' }, { status: 502 })
  }
}
