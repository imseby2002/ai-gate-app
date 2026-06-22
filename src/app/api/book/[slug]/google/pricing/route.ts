import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadFeedProfile, lowestAvailableRate } from '@/lib/booking/google-feed'

// Google Hotel Center 即時房價: 收到 <Query> 回傳 <Transaction>/<Result>。
// 規格: https://developers.google.com/hotels/hotel-prices/dev-guide/transaction-messages
// 整間民宿視為一間 hotel(slug)，房價=該區間最低可訂房型價(顯示「$X 起」)。

interface Combo { checkin: string; nights: number }

function allMatches(re: RegExp, s: string): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) out.push(m[1])
  return out
}

function parseQuery(body: string): Combo[] {
  const checkins = allMatches(/<Checkin>\s*([\d-]+)\s*<\/Checkin>/gi, body)
  const nights = allMatches(/<Nights>\s*(\d+)\s*<\/Nights>/gi, body).map(Number)
  const combos: Combo[] = []
  for (const ci of checkins) for (const n of nights) if (n > 0) combos.push({ checkin: ci, nights: n })
  return combos
}

function defaultCombos(days: number): Combo[] {
  const today = new Date()
  return Array.from({ length: days }, (_, i) => ({
    checkin: new Date(today.getTime() + (i + 1) * 86400000).toISOString().slice(0, 10),
    nights: 1,
  }))
}

async function buildTransaction(slug: string, userId: string, combos: Combo[]): Promise<string> {
  const admin = createAdminClient()
  const results: string[] = []
  for (const { checkin, nights } of combos) {
    const rate = await lowestAvailableRate(admin, userId, checkin, nights)
    if (!rate) continue // 無可訂房型 → 省略(Google 視為當日無房)
    results.push(
      `  <Result>\n` +
      `    <Property>${slug}</Property>\n` +
      `    <Checkin>${checkin}</Checkin>\n` +
      `    <Nights>${nights}</Nights>\n` +
      `    <Baserate currency="${rate.currency}">${rate.total}</Baserate>\n` +
      `    <Tax currency="${rate.currency}">0</Tax>\n` +
      `    <OtherFees currency="${rate.currency}">0</OtherFees>\n` +
      `  </Result>`,
    )
  }
  const id = Date.now().toString()
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Transaction timestamp="${new Date().toISOString()}" id="${id}">\n` +
    results.join('\n') +
    (results.length ? '\n' : '') +
    `</Transaction>`
}

async function handle(slug: string, combos: Combo[] | null) {
  const admin = createAdminClient()
  const profile = await loadFeedProfile(admin, slug)
  if (!profile || !profile.google_feed_enabled) {
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<Transaction timestamp="${new Date().toISOString()}" id="0">\n</Transaction>`,
      { status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
  }
  const xml = await buildTransaction(slug, profile.user_id, combos?.length ? combos : defaultCombos(60))
  return new NextResponse(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// Google 以 POST 送 <Query>
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = await req.text().catch(() => '')
  return handle(slug, parseQuery(body))
}

// 瀏覽器直接開啟 → 預設未來 60 天每日最低房價，方便檢視
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return handle(slug, null)
}
