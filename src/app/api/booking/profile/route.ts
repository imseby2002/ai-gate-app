import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('bnb_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ profile: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const fields = [
    'name','description','address','city','phone','email',
    'website','line_id','check_in_time','check_out_time',
    'min_nights','amenities','images','house_rules','breakfast','addon_services','slug',
    'tagline','about','social_links','faq','theme_color','seo_title','seo_description',
    'template_id','hero_cta_text','booking_instructions','cancellation_policy',
    'contact_map_embed','contact_note','owner_intro',
    'competitor_watchlist',
  ]
  const updates: Record<string, unknown> = {}
  for (const f of fields) if (f in body) updates[f] = body[f]
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('bnb_profiles')
    .upsert({ name: '', ...updates, user_id: user.id }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ profile: data })
}
