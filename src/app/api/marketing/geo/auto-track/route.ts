/**
 * GET/POST /api/marketing/geo/auto-track
 * 讀取/設定專案的「每週自動引用追蹤」開關（per-project）。
 * GET  ?projectId=  → { autoTrack }
 * POST { projectId, autoTrack } → { ok }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: '缺少 projectId' }, { status: 400 })

  const { data } = await supabase
    .from('geo_projects')
    .select('auto_track')
    .eq('id', projectId)
    .single()
  return NextResponse.json({ autoTrack: !!data?.auto_track })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, autoTrack } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少 projectId' }, { status: 400 })

  const { error } = await supabase
    .from('geo_projects')
    .update({ auto_track: !!autoTrack })
    .eq('id', projectId)
  if (error) return NextResponse.json({ error: '儲存失敗' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
