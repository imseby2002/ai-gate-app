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
import { ownerMemberIds } from '@/lib/geo/autopilot-schedule'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const c = await currentDataOwner()
  if (!c) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })
  const sp = new URL(req.url).searchParams
  const locale = ['zh-TW', 'en', 'vi'].includes(sp.get('locale') ?? '') ? sp.get('locale')! : 'zh-TW'
  const focus = (sp.get('focus') ?? '').slice(0, 500)
  // 避開公司已寫過的主題
  const members = await ownerMemberIds(c.admin, c.ownerId)
  const { data: done } = await c.admin.from('geo_projects').select('seed_topic').in('user_id', members)
    .order('created_at', { ascending: false }).limit(40)
  const avoid = (done ?? []).map(d => String(d.seed_topic ?? '')).filter(Boolean)
  const { topics } = await suggestTopics(c.admin, c.ownerId, avoid, locale, focus)
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
