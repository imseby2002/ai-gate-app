/**
 * POST /api/marketing/geo/audit
 * GEO Score 落地頁審計：抓取 URL 算 0–100 綜合分（可引用度/結構化資料/技術/E-E-A-T/爬蟲放行）。
 * Body: { url: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { auditUrl } from '@/lib/geo/audit'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await req.json()
  if (!url?.trim()) return NextResponse.json({ error: '請輸入要審計的網址' }, { status: 400 })

  try {
    return NextResponse.json(await auditUrl(url.trim()))
  } catch (err) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 })
  }
}
