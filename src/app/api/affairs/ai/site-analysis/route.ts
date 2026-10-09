import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { generateWithSearch, parseJsonObject, replyLanguage } from '@/lib/affairs/ai'

export const maxDuration = 300

// 位置市場分析：依候選點地址自動搜尋周邊人口、居民組成、人均收入、學校、大型住宅區、人流車流與門面。
export async function POST(req: NextRequest) {
  const ctx = await getUnitContext('affairs')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })

  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  const radius = Math.min(3000, Math.max(200, Number(body.radius_m) || 1000))
  const { data: site } = await ctx.admin.from('affair_sites').select('*').eq('id', id).eq('owner_id', ctx.ownerId).maybeSingle()
  if (!site) return NextResponse.json({ error: '找不到候選點' }, { status: 404 })
  if (!site.address && !site.region) return NextResponse.json({ error: '請先填寫地址或區域' }, { status: 400 })

  const lang = await replyLanguage()
  const system = `你是零售展店的商圈分析師，為手搖飲／茶飲門市評估開店位置。必須先用 web_search 查證公開資料（政府統計、人口普查、學校名錄、建案資料、地圖與新聞），再輸出分析。
規則：
- 用${lang}撰寫所有文字欄位。
- 只寫查得到或可合理推估的數字；推估要在 note 註明「推估」與依據；查不到的數字填 null，不要編造。
- 只回傳一個 JSON 物件，不要 markdown。`

  const prompt = `候選點資料：
${JSON.stringify({
    name: site.name, category: site.category, subtype: site.subtype, address: site.address, region: site.region,
    floor: site.floor, area_sqm: site.area_sqm, frontage_m: site.frontage_m, monthly_rent: site.monthly_rent, households: site.households, notes: site.notes,
  })}

請分析半徑 ${radius} 公尺範圍，回傳以下 JSON：
{
  "summary": "三到五句總結",
  "score": 0-100 的開店適合度,
  "recommendation": "go" | "consider" | "avoid",
  "population": { "residents": 數字或 null, "density_per_km2": 數字或 null, "note": "" },
  "demographics": { "age_groups": [{ "label": "15-24", "share_pct": 數字 }], "composition": "居民組成（學生、上班族、家庭、外來人口等）", "note": "" },
  "income": { "per_capita_monthly": 數字或 null, "currency": "", "level": "high" | "medium" | "low", "note": "" },
  "schools": [{ "name": "", "type": "小學/國中/高中/大學/補習班等", "students": 數字或 null, "distance_m": 數字或 null }],
  "residential": [{ "name": "大型住宅區或社區", "households": 數字或 null, "distance_m": 數字或 null, "note": "" }],
  "foot_traffic": { "level": "high" | "medium" | "low", "peak_hours": "", "note": "" },
  "vehicle_traffic": { "level": "high" | "medium" | "low", "note": "道路等級、機車／汽車流量、停車" },
  "storefront": { "visibility": "high" | "medium" | "low", "note": "門面、能見度、騎樓／人行道、招牌條件" },
  "competitors": [{ "name": "", "distance_m": 數字或 null, "note": "" }],
  "rent": { "estimate_monthly": 數字或 null, "currency": "", "note": "與此點位租金比較" },
  "opportunities": [""],
  "risks": [""]
}`

  try {
    const r = await generateWithSearch({ system, messages: [{ role: 'user', content: prompt }], maxSearches: 8, maxOutputTokens: 6000 })
    const parsed = parseJsonObject<Record<string, unknown>>(r.text)
    if (!parsed) return NextResponse.json({ error: 'AI 回傳格式錯誤' }, { status: 502 })
    const analysis = { ...parsed, radius_m: radius, sources: r.sources }
    const analysis_at = new Date().toISOString()
    await ctx.admin.from('affair_sites').update({ analysis, analysis_at }).eq('id', id).eq('owner_id', ctx.ownerId)
    return NextResponse.json({ analysis, analysis_at })
  } catch (e) {
    console.error('[affairs/ai/site-analysis]', e)
    return NextResponse.json({ error: e instanceof Error && e.message === 'AI 金鑰未設定' ? e.message : 'AI 服務暫時無法使用，請稍後再試' }, { status: 502 })
  }
}
