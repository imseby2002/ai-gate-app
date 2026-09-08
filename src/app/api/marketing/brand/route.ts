// 行銷中心「品牌資料」：沿用 mkt_brand（與辦公室 /mkt 同一份），改以行銷模組權限存取。
import { marketingCompany } from '@/lib/marketing/company'
import { NextRequest, NextResponse } from 'next/server'

const s = (v: unknown) => String(v ?? '').trim()

export async function GET() {
  const c = await marketingCompany(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data } = await c.admin.from('mkt_brand').select('*').eq('owner_id', c.ownerId).maybeSingle()
  return NextResponse.json({ brand: data ?? null })
}

export async function PUT(req: NextRequest) {
  const c = await marketingCompany(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const colors = (b.colors && typeof b.colors === 'object') ? {
    primary: s(b.colors.primary), secondary: s(b.colors.secondary), accent: s(b.colors.accent),
  } : {}
  const platforms = (b.platforms && typeof b.platforms === 'object') ? b.platforms : {}
  const { error } = await c.admin.from('mkt_brand').upsert({
    owner_id: c.ownerId,
    name: s(b.name), slogan: s(b.slogan), tagline: s(b.tagline), colors, platforms,
    fonts: s(b.fonts), tone: s(b.tone), audience: s(b.audience),
    selling_points: s(b.selling_points), banned_words: s(b.banned_words),
    brand_story: s(b.brand_story), logo_url: s(b.logo_url),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
