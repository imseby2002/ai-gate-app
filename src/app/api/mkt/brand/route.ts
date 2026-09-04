import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() { const c = await getUnitContext('mkt'); return c.ok ? c : null }
const s = (v: unknown) => String(v ?? '').trim()

// 品牌檔（每公司一份）
export async function GET() {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data } = await c.admin.from('mkt_brand').select('*').eq('owner_id', c.ownerId).maybeSingle()
  return NextResponse.json({ brand: data ?? null })
}

// 建立/更新品牌檔
export async function PUT(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const colors = (b.colors && typeof b.colors === 'object') ? {
    primary: s(b.colors.primary), secondary: s(b.colors.secondary), accent: s(b.colors.accent),
  } : {}
  const { error } = await c.admin.from('mkt_brand').upsert({
    owner_id: c.ownerId,
    name: s(b.name), slogan: s(b.slogan), tagline: s(b.tagline), colors,
    fonts: s(b.fonts), tone: s(b.tone), audience: s(b.audience),
    selling_points: s(b.selling_points), banned_words: s(b.banned_words),
    brand_story: s(b.brand_story), logo_url: s(b.logo_url),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
