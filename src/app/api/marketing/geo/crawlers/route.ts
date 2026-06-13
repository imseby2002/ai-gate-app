/**
 * GET /api/marketing/geo/crawlers?domain=  或  ?projectId=
 * 檢查目標網域 robots.txt 對各大 AI 爬蟲的放行狀況。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCrawlers } from '@/lib/geo/crawlers'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let domain = req.nextUrl.searchParams.get('domain') ?? ''
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!domain && projectId) {
    const { data } = await supabase.from('geo_projects').select('target_domain').eq('id', projectId).single()
    domain = data?.target_domain ?? ''
  }
  if (!domain.trim()) return NextResponse.json({ error: '請提供目標網域' }, { status: 400 })

  return NextResponse.json(await checkCrawlers(domain))
}
