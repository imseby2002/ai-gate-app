import { getUnitContext } from '@/lib/auth/unit-access'
import { buildMktSnapshot, type MktSnapshot } from '@/lib/mkt/analytics'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
const PLAT: Record<string, string> = { grab: 'GrabFood', shopee: 'ShopeeFood', baemin: 'Baemin', other: '其他' }
const TYPE: Record<string, string> = { material: '門市物料', event: '地推活動', outdoor: '戶外廣告', partner: '異業合作' }

function snapshotToText(s: MktSnapshot): string {
  const L: string[] = []
  L.push('【外送平台】')
  for (const p of s.delivery.byPlatform) L.push(`- ${PLAT[p.platform] ?? p.platform}：上架 ${p.online}/${p.count}、訂單 ${fmt(p.orders)}、營收 ${fmt(p.revenue)}`)
  L.push(`外送合計：訂單 ${fmt(s.delivery.totalOrders)}、營收 ${fmt(s.delivery.totalRevenue)}`)
  L.push(`\n【實體行銷】支出合計 ${fmt(s.offline.spend)}、進行中 ${s.offline.active}`)
  for (const t of s.offline.byType) L.push(`- ${TYPE[t.type] ?? t.type}：${t.count} 項、預算 ${fmt(t.spend)}`)
  L.push(`\n【內容】累計產出 ${s.content.total}、待審核 ${s.content.review}、已發布 ${s.content.published}`)
  if (s.pnl) L.push(`\n【損益對照（${s.pnl.period}）】全公司營業額 ${fmt(s.pnl.revenue)}、廣告費 ${fmt(s.pnl.advertising)}`)
  L.push(`\n行銷總支出（實體預算＋廣告費）：${fmt(s.spend_total)}`)
  if (s.delivery_share != null) L.push(`外送營收佔全公司營業額：${(s.delivery_share * 100).toFixed(1)}%`)
  return L.join('\n')
}

export async function POST(req: NextRequest) {
  const c = await getUnitContext('mkt')
  if (!c.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const kind = b.kind === 'monthly' ? '月報' : '週報'
  const snap = await buildMktSnapshot(c.admin, c.ownerId)
  const body = snapshotToText(snap)
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ report: `行銷${kind}\n\n${body}`, snapshot: snap })

  const system = `你是連鎖飲料品牌的行銷長，為行銷團隊撰寫${kind}。
原則：先講重點結論與需注意處（外送成長/衰退、行銷支出效率、內容產能），再給具體建議行動。
用繁體中文、條列、務實，控制在 500 字內，不要編造資料裡沒有的數字。`
  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await generateText({ model: anthropic('claude-sonnet-4-5'), system, maxOutputTokens: 1500, messages: [{ role: 'user', content: `以下是本期行銷彙整資料，請產出${kind}：\n\n${body}` }] })
    return NextResponse.json({ report: res.text.trim(), snapshot: snap })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
