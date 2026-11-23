// 連接器房名對應：把各平台後台房名 ↔ 系統房源綁定，提升自動配對率。
// GET：列出已建對應、未對應房名（來自連接器既有「房型未定」訂單）、房源清單。
// POST：新增/更新一筆對應，並回填既有同平台同房名的「房型未定」訂單。
// DELETE：刪除一筆對應。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBnbContext } from '@/lib/bnb/context'
import { syncDailyRecordForBooking } from '@/lib/booking/daily-sync'

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()

  const [{ data: aliases }, { data: props }, { data: unmappedRows }] = await Promise.all([
    admin.from('connector_room_aliases')
      .select('id, platform, room_name, property_id, created_at')
      .eq('user_id', ctx.ownerId).order('platform').order('room_name'),
    admin.from('properties').select('id, name').eq('user_id', ctx.ownerId).order('name'),
    admin.from('bookings')
      .select('platform, raw_data')
      .eq('user_id', ctx.ownerId).eq('source', 'connector')
      .is('property_id', null).neq('status', 'cancelled'),
  ])

  // 聚合未對應房名（platform + room_name）出現次數
  const mapped = new Set((aliases ?? []).map(a => `${a.platform}||${a.room_name.trim().toLowerCase()}`))
  const counter = new Map<string, { platform: string; room_name: string; count: number }>()
  for (const b of unmappedRows ?? []) {
    const rn = ((b.raw_data as Record<string, unknown> | null)?.room_name as string | null)?.trim()
    if (!rn) continue
    const key = `${b.platform}||${rn.toLowerCase()}`
    if (mapped.has(key)) continue
    const cur = counter.get(key)
    if (cur) cur.count++
    else counter.set(key, { platform: b.platform as string, room_name: rn, count: 1 })
  }
  const unmapped = [...counter.values()].sort((a, b) => b.count - a.count)

  return NextResponse.json({ aliases: aliases ?? [], properties: props ?? [], unmapped })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canSettings) return NextResponse.json({ error: '只有擁有者或管理員可設定' }, { status: 403 })

  const { platform, room_name, property_id } = await req.json().catch(() => ({}))
  const p = String(platform ?? '').trim()
  const rn = String(room_name ?? '').trim()
  const pid = String(property_id ?? '').trim()
  if (!p || !rn || !pid) return NextResponse.json({ error: 'platform / room_name / property_id 必填' }, { status: 400 })

  const admin = createAdminClient()
  // 房源需屬本帳號
  const { data: prop } = await admin.from('properties').select('id').eq('id', pid).eq('user_id', ctx.ownerId).maybeSingle()
  if (!prop) return NextResponse.json({ error: '房源不存在' }, { status: 400 })

  // 以 (user_id, platform, lower(room_name)) 去重：先刪同鍵再插
  await admin.from('connector_room_aliases').delete()
    .eq('user_id', ctx.ownerId).eq('platform', p).ilike('room_name', rn)
  const { error: insErr } = await admin.from('connector_room_aliases')
    .insert({ user_id: ctx.ownerId, platform: p, room_name: rn, property_id: pid })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // 回填既有「房型未定」的同平台同房名訂單
  const { data: targets } = await admin.from('bookings')
    .select('id, property_id, guest_name, total_price, num_guests, check_in, check_out, status, platform, raw_data')
    .eq('user_id', ctx.ownerId).eq('source', 'connector').eq('platform', p)
    .is('property_id', null).neq('status', 'cancelled')
  let backfilled = 0
  for (const b of targets ?? []) {
    const bn = ((b.raw_data as Record<string, unknown> | null)?.room_name as string | null)?.trim()
    if (!bn || bn.toLowerCase() !== rn.toLowerCase()) continue
    const { data: updated } = await admin.from('bookings')
      .update({ property_id: pid, updated_at: new Date().toISOString() }).eq('id', b.id)
      .select('id, property_id, guest_name, total_price, num_guests, check_in, check_out, status, platform').single()
    if (updated) {
      await syncDailyRecordForBooking(admin, ctx.ownerId, updated, b).catch(() => {})
      backfilled++
    }
  }

  return NextResponse.json({ ok: true, backfilled })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canSettings) return NextResponse.json({ error: '只有擁有者或管理員可設定' }, { status: 403 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })
  const { error } = await createAdminClient().from('connector_room_aliases')
    .delete().eq('id', id).eq('user_id', ctx.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
