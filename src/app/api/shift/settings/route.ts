/**
 * 排班邏輯設定
 * GET /api/shift/settings?store=  → { settings（實際使用）, company（公司預設）, own（本店覆寫）, defaults, canEditCompany }
 * PUT /api/shift/settings  body: { store: 門市代碼 | '*'（公司預設）, settings }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getShiftContext, storeAllowed } from '@/lib/shift/scope'
import { DEFAULT_SETTINGS, loadSettings, sanitizeSettings } from '@/lib/shift/settings'
import type { UnitContext } from '@/lib/auth/unit-access'

const deny = (ctx: UnitContext) => NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
// 公司預設：公司負責人／IT 或有「門市」單位權限者（領班只能改自己門市）
const canEditCompany = (ctx: UnitContext) => ctx.isAdmin || (ctx.units ?? []).includes('store')

export async function GET(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return deny(ctx)
  const store = (req.nextUrl.searchParams.get('store') ?? '').trim()
  if (!store || (store !== '*' && !storeAllowed(ctx, store))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { merged, company, own } = await loadSettings(ctx.admin, ctx.ownerId, store)
  return NextResponse.json({ settings: merged, company, own, defaults: DEFAULT_SETTINGS, canEditCompany: canEditCompany(ctx) })
}

export async function PUT(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return deny(ctx)
  const b = await req.json().catch(() => ({}))
  const store = String(b.store ?? '').trim()
  if (!store) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  if (store === '*' ? !canEditCompany(ctx) : !storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const settings = sanitizeSettings(b.settings)
  const { error } = await ctx.admin.from('shift_settings').upsert({
    owner_id: ctx.ownerId, store, settings, updated_by: ctx.userId, updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id,store' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
