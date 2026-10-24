/**
 * GET/POST /api/marketing/geo/auto-pilot
 * GEO 一鍵全自動巡航產出：
 *  - GET : 分析公司資源庫（品牌、門市、產品），主動推薦 4~6 個熱門高價值 GEO 主題
 *  - POST: 一鍵全自動巡航（選題 ➔ 探勘高價值問句 ➔ 整合公司事實 ➔ 產出權威文章與結構化資料）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { currentDataOwner } from '@/lib/company/profile'
import { suggestTopics, runAutoPilot } from '@/lib/geo/autopilot'

export const maxDuration = 300

export async function GET() {
  const c = await currentDataOwner()
  if (!c) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })
  const { topics } = await suggestTopics(c.admin, c.ownerId)
  return NextResponse.json({ topics })
}

export async function POST(req: NextRequest) {
  const c = await currentDataOwner()
  if (!c) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })

  const { topic, locale = 'zh-TW' } = await req.json().catch(() => ({}))
  try {
    const supabase = await createClient()
    const result = await runAutoPilot({ admin: c.admin, db: supabase, userId: c.userId, ownerId: c.ownerId, topic, locale })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cost, ...body } = result
    return NextResponse.json(body)
  } catch (err) {
    console.error('[geo/auto-pilot] POST error', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
