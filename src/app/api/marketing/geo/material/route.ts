/**
 * GET/POST /api/marketing/geo/material
 * GEO 素材庫（per-user）：商家檔案（LocalBusiness）、作者（Person/E-E-A-T）、獨家事實片段。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('geo_material')
    .select('business, authors, facts')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    business: data?.business ?? null,
    authors: data?.authors ?? [],
    facts: data?.facts ?? [],
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { business, authors, facts } = await req.json()
  const { error } = await supabase.from('geo_material').upsert({
    user_id: user.id,
    business: business ?? null,
    authors: Array.isArray(authors) ? authors : [],
    facts: Array.isArray(facts) ? facts : [],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) {
    console.error('[geo/material] upsert', error)
    return NextResponse.json({ error: '儲存失敗' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
