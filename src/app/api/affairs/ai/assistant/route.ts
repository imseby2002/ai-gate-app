import { NextRequest, NextResponse } from 'next/server'
import type { ModelMessage } from 'ai'
import { getUnitContext } from '@/lib/auth/unit-access'
import { generateWithSearch, replyLanguage } from '@/lib/affairs/ai'

export const maxDuration = 300

// 外務 AI 助手：找便宜又好的店面位置、公家／私人部門的申請流程與管道、關係維護建議。
export async function POST(req: NextRequest) {
  const ctx = await getUnitContext('affairs')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })

  const body = await req.json().catch(() => ({}))
  const messages: ModelMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m: { role?: string; content?: unknown }) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-20)
    .map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content.slice(0, 8000) }))
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: '請輸入問題' }, { status: 400 })
  }

  const [{ data: sites }, { data: contacts }] = await Promise.all([
    ctx.admin.from('affair_sites').select('name, category, subtype, region, address, status, monthly_rent, area_sqm, application_deadline').eq('owner_id', ctx.ownerId).order('updated_at', { ascending: false }).limit(30),
    ctx.admin.from('affair_contacts').select('category, org_type, organization, region').eq('owner_id', ctx.ownerId).limit(500),
  ])
  const contactSummary: Record<string, number> = {}
  for (const c of contacts ?? []) {
    const k = [c.category, c.org_type].filter(Boolean).join('/')
    contactSummary[k] = (contactSummary[k] ?? 0) + 1
  }

  const lang = await replyLanguage()
  const system = `你是連鎖餐飲品牌（手搖飲／茶飲）外務部門的資深展店與政府關係顧問。外務的工作包括：
1. 尋找與開發門市：街邊門市（一樓大門市、一樓小門市、店中店、店門櫃、外送店——外送店可在二樓或位置較差處以壓低租金）、MALL（社區型 MALL 看住戶數、非社區型 MALL）、公家部門（機場、政府發布發展的區域）、私人部門（工廠內部、私人發展的聚集市集）。公家與私人部門都需要主動申請並通過資格審核。
2. 關係維護：房東、MALL 管理人員、公家部門（投資廳、衛生管理、市場公安、經濟公安、稅務、消防、環保、勞動等）、私人部門（工廠負責人、市集管理人員）。
3. 租金行情與漲跌分析、位置市場分析（人口、居民組成、人均收入、學校、大型住宅區、人流、車流、門面）。

回答原則：
- 用${lang}回答，條列具體步驟、管道、所需文件、主管機關名稱、時程與費用區間。
- 涉及法規、申請流程、租金行情、招標公告等具時效的資訊時，先用 web_search 查證，並在內容中標註來源。查不到就直說，不要編造數字或機關名稱。
- 給出談判與壓低租金的實際做法（例如比價依據、長約換優惠、免租期、裝修期、外送店選次要位置）。
- 若問題與公司現有候選點或聯絡人有關，參考下方資料。

公司目前的候選點（最多 30 筆）：
${JSON.stringify(sites ?? [])}

聯絡人分類數量：
${JSON.stringify(contactSummary)}`

  try {
    const r = await generateWithSearch({ system, messages, maxSearches: 5, maxOutputTokens: 4000 })
    return NextResponse.json({ reply: r.text, sources: r.sources })
  } catch (e) {
    console.error('[affairs/ai/assistant]', e)
    return NextResponse.json({ error: e instanceof Error && e.message === 'AI 金鑰未設定' ? e.message : 'AI 服務暫時無法使用，請稍後再試' }, { status: 502 })
  }
}
