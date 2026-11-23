// 連接器房名對應（寫入「房型管理」的 name_aliases，與 Email 同步共用同一套別名）。
// GET：列出「待對應」房名（連接器既有房型未定、且用別名仍配不到的房名）＋房源清單。
// POST：把房名加入指定房源的 name_aliases（去重），並回填既有同房名的房型未定訂單。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBnbContext } from '@/lib/bnb/context'
import { syncDailyRecordForBooking } from '@/lib/booking/daily-sync'
import { matchPropertyByName } from '@/lib/booking/email-sync'

type PropRow = { id: string; name: string; name_aliases: string[] }

function cleanRoomName(roomName: string | undefined | null): string | null {
  const n = (roomName ?? '').trim()
  if (!n) return null
  return n.replace(/\s*[（(]\s*\d{3,}\s*[)）]\s*$/, '').trim() || n
}

async function loadProps(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<PropRow[]> {
  const { data } = await admin.from('properties').select('id, name, name_aliases').eq('user_id', userId)
  return (data ?? []).map(p => ({
    id: p.id as string, name: p.name as string, name_aliases: (p.name_aliases as string[] | null) ?? [],
  }))
}

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()

  const props = await loadProps(admin, ctx.ownerId)
  const { data: rows } = await admin.from('bookings')
    .select('platform, raw_data')
    .eq('user_id', ctx.ownerId).eq('source', 'connector')
    .is('property_id', null).neq('status', 'cancelled')

  // 聚合仍配不到房源的房名（platform + room_name）
  const counter = new Map<string, { platform: string; room_name: string; count: number }>()
  for (const b of rows ?? []) {
    const rn = cleanRoomName((b.raw_data as Record<string, unknown> | null)?.room_name as string | null)
    if (!rn) continue
    if (matchPropertyByName(rn, props)) continue // 別名已能配到，不列入待對應
    const key = `${b.platform}||${rn.toLowerCase()}`
    const cur = counter.get(key)
    if (cur) cur.count++
    else counter.set(key, { platform: b.platform as string, room_name: rn, count: 1 })
  }
  const unmapped = [...counter.values()].sort((a, b) => b.count - a.count)

  return NextResponse.json({ properties: props.map(p => ({ id: p.id, name: p.name })), unmapped })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canSettings) return NextResponse.json({ error: '只有擁有者或管理員可設定' }, { status: 403 })

  const { room_name, property_id } = await req.json().catch(() => ({}))
  const rn = cleanRoomName(room_name)
  const pid = String(property_id ?? '').trim()
  if (!rn || !pid) return NextResponse.json({ error: 'room_name / property_id 必填' }, { status: 400 })

  const admin = createAdminClient()
  const { data: prop } = await admin.from('properties')
    .select('id, name_aliases').eq('id', pid).eq('user_id', ctx.ownerId).maybeSingle()
  if (!prop) return NextResponse.json({ error: '房源不存在' }, { status: 400 })

  // 加入 name_aliases（去重，不分大小寫）
  const existing = (prop.name_aliases as string[] | null) ?? []
  if (!existing.some(a => a.toLowerCase() === rn.toLowerCase())) {
    const { error: upErr } = await admin.from('properties')
      .update({ name_aliases: [...existing, rn] }).eq('id', pid)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  // 回填：既有房型未定的連接器訂單，房名（清理後）等於此別名者 → 指派此房源
  const { data: targets } = await admin.from('bookings')
    .select('id, property_id, guest_name, total_price, num_guests, check_in, check_out, status, platform, raw_data')
    .eq('user_id', ctx.ownerId).eq('source', 'connector')
    .is('property_id', null).neq('status', 'cancelled')
  let backfilled = 0
  for (const b of targets ?? []) {
    const bn = cleanRoomName((b.raw_data as Record<string, unknown> | null)?.room_name as string | null)
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
