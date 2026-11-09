/**
 * 多分店
 * GET  /api/reserve/stores            → 我的所有門市與目前操作的門市
 * POST /api/reserve/stores { name, slug?, copyFrom? }  → 新增分店（可複製目前門市的設定、服務與人員）
 * PUT  /api/reserve/stores { id }     → 切換目前操作的門市
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { STORE_COOKIE, getCurrentStore, listStores } from '@/lib/reserve/current-store'
import { getReserveEntitlements } from '@/lib/reserve/entitlements'

const COOKIE_OPTS = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: true, maxAge: 60 * 60 * 24 * 365 }
const COPY_STORE_FIELDS = ['category', 'description', 'phone', 'email', 'business_hours', 'slot_interval_minutes', 'advance_booking_days',
  'min_booking_hours', 'allow_any_staff', 'deposit_required', 'deposit_amount', 'currency', 'notice',
  'sms_reminder_enabled', 'sms_reminder_hours', 'sms_reminder_template'] as const

async function authed() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(req: NextRequest) {
  const user = await authed()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const [stores, current, ent] = await Promise.all([listStores(user.id, admin), getCurrentStore<{ id: string }>(user.id, req, 'id', admin), getReserveEntitlements(user.id)])
  return NextResponse.json({ stores, currentId: current?.id ?? null, max: ent.features.maxStores, plan: ent.plan })
}

export async function POST(req: NextRequest) {
  const user = await authed()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { name?: string; slug?: string; copyFrom?: boolean }
  const name = String(body.name ?? '').trim().slice(0, 80)
  if (!name) return NextResponse.json({ error: '請輸入分店名稱' }, { status: 400 })
  const slug = String(body.slug ?? '').trim().toLowerCase() || `store-${user.id.slice(0, 6)}-${Date.now().toString(36)}`
  if (!/^[a-z0-9][a-z0-9-]{2,49}$/.test(slug)) return NextResponse.json({ error: '預約網址只能用英文小寫、數字與 -，3～50 字' }, { status: 400 })

  const admin = createAdminClient()
  const existing = await listStores(user.id, admin)
  const { plan, features } = await getReserveEntitlements(user.id)
  if (existing.length >= features.maxStores) {
    return NextResponse.json({
      error: plan === 'free' ? 'FREE 方案只能建立 1 間門市，升級 CORE 可管理最多 20 間分店' : `最多 ${features.maxStores} 間分店`,
      plan, upgrade: plan === 'free',
    }, { status: 403 })
  }

  const source = body.copyFrom ? await getCurrentStore<Record<string, unknown>>(user.id, req, '*', admin) : null
  const copied: Record<string, unknown> = {}
  if (source) for (const k of COPY_STORE_FIELDS) if (source[k] !== undefined) copied[k] = source[k]

  const { data: store, error } = await admin.from('reserve_stores')
    .insert({ ...copied, name, slug, user_id: user.id, is_active: true })
    .select('id, name, slug, is_active, created_at').single()
  if (error || !store) {
    return NextResponse.json({ error: error?.code === '23505' ? '這個預約網址已被使用，請換一個' : (error?.message ?? '建立失敗') }, { status: 400 })
  }

  if (source) {
    const [{ data: services }, { data: staff }] = await Promise.all([
      admin.from('reserve_services').select('*').eq('store_id', source.id as string),
      admin.from('reserve_staff').select('*').eq('store_id', source.id as string),
    ])
    const idMap = new Map<string, string>()
    for (const s of services ?? []) {
      const { id, created_at: _c, updated_at: _u, ...rest } = s as Record<string, unknown>
      void _c; void _u
      const { data: ns } = await admin.from('reserve_services').insert({ ...rest, store_id: store.id }).select('id').single()
      if (ns) idMap.set(id as string, ns.id)
    }
    const staffRows = (staff ?? []).map(st => {
      const { id: _i, created_at: _c, updated_at: _u, service_ids, ...rest } = st as Record<string, unknown>
      void _i; void _c; void _u
      return { ...rest, store_id: store.id, service_ids: ((service_ids as string[] | null) ?? []).map(x => idMap.get(x)).filter(Boolean) }
    })
    if (staffRows.length) await admin.from('reserve_staff').insert(staffRows)
  }

  const res = NextResponse.json({ store })
  res.cookies.set(STORE_COOKIE, store.id, COOKIE_OPTS)
  return res
}

export async function PUT(req: NextRequest) {
  const user = await authed()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json().catch(() => ({})) as { id?: string }
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { data } = await createAdminClient().from('reserve_stores').select('id').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const res = NextResponse.json({ ok: true, currentId: id })
  res.cookies.set(STORE_COOKIE, id, COOKIE_OPTS)
  return res
}
