/**
 * POST /api/marketing/geo/citability
 * 段落可引用度評分（純運算，不耗 AI 額度）。
 * Body: { articleId?: string; bodyMd?: string }
 * Resp: CitabilityReport
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scoreCitability } from '@/lib/geo/citability'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { articleId, bodyMd } = await req.json()

  let md = typeof bodyMd === 'string' ? bodyMd : ''
  if (!md && articleId) {
    const { data } = await supabase
      .from('geo_articles')
      .select('body_md')
      .eq('id', articleId)
      .single()
    md = data?.body_md ?? ''
  }
  if (!md.trim()) return NextResponse.json({ error: '缺少文章內容' }, { status: 400 })

  return NextResponse.json(scoreCitability(md))
}
