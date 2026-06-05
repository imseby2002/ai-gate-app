import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/booking/daily?date=2026-05-30
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date')
    ?? new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

  const prev = new Date(date)
  prev.setDate(prev.getDate() - 1)
  const prevDate = prev.toLocaleDateString('sv-SE')

  // 取得所有需要的資料
  const { data: existing } = await supabase
    .from('bnb_daily_records')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .order('sort_order')
    .order('room_name')

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('user_id', user.id)
    .order('created_at')

  const { data: todayBookings } = await supabase
    .from('bookings')
    .select('property_id, guest_name, platform_booking_id, check_in')
    .eq('user_id', user.id)
    .eq('check_in', date)
    .order('created_at')

  const { data: prevRecords } = await supabase
    .from('bnb_daily_records')
    .select('room_name, room_password, gate_password')
    .eq('user_id', user.id)
    .eq('date', prevDate)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingList: any[] = existing ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const propList: any[] = properties ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookingList: any[] = todayBookings ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prevList: any[] = prevRecords ?? []

  // 刪除不在 properties 的過期記錄（已刪除的房型）
  const validNames = new Set(propList.map(p => p.name as string))
  const stale = existingList.filter(r => !validNames.has(r.room_name))
  if (stale.length > 0) {
    await supabase.from('bnb_daily_records')
      .delete()
      .in('id', stale.map(r => r.id))
  }
  const cleanList = existingList.filter(r => validNames.has(r.room_name))

  const existingNames = new Set(cleanList.map(r => r.room_name as string))

  // 昨日密碼 map
  const prevByRoom: Record<string, { room_password: string | null; gate_password: string | null }> = {}
  for (const r of prevList) {
    prevByRoom[r.room_name] = { room_password: r.room_password, gate_password: r.gate_password }
  }

  // 今日訂單依 property_id 分組
  const bookingByPropId: Record<string, { guest_name: string; platform_booking_id: string }> = {}
  for (const b of bookingList) {
    if (!bookingByPropId[b.property_id]) {
      bookingByPropId[b.property_id] = { guest_name: b.guest_name, platform_booking_id: b.platform_booking_id }
    }
  }

  // 新增缺少的房型記錄
  const missing = propList
    .filter(p => !existingNames.has(p.name))
    .map((p, i) => {
      const booking = bookingByPropId[p.id]
      const yesterday = prevByRoom[p.name]
      return {
        user_id: user.id,
        date,
        room_name: p.name,
        room_password: yesterday?.room_password ?? null,
        gate_password: yesterday?.gate_password ?? null,
        order_number: booking?.platform_booking_id ?? null,
        guest_name: booking?.guest_name ?? null,
        source: booking ? 'booking' : 'manual',
        sort_order: cleanList.length + i,
        updated_at: new Date().toISOString(),
      }
    })

  let created: unknown[] = []
  if (missing.length > 0) {
    const { data } = await supabase
      .from('bnb_daily_records')
      .upsert(missing, { onConflict: 'user_id,date,room_name' })
      .select()
    created = data ?? []
  }

  // 補填現有記錄中空白的訂單欄位
  for (const rec of cleanList) {
    const prop = propList.find(p => p.name === rec.room_name)
    if (!prop) continue
    const booking = bookingByPropId[prop.id]
    if (booking && !rec.order_number && !rec.guest_name) {
      await supabase.from('bnb_daily_records').update({
        order_number: booking.platform_booking_id ?? null,
        guest_name: booking.guest_name ?? null,
        source: 'booking',
        updated_at: new Date().toISOString(),
      }).eq('id', rec.id)
      rec.order_number = booking.platform_booking_id ?? null
      rec.guest_name = booking.guest_name ?? null
    }
  }

  // 依房型管理順序排序
  const nameOrder: Record<string, number> = {}
  propList.forEach((p, i) => { nameOrder[p.name] = i })

  const all = [...cleanList, ...created]
  all.sort((a: { room_name: string }, b: { room_name: string }) =>
    (nameOrder[a.room_name] ?? 999) - (nameOrder[b.room_name] ?? 999)
  )

  // 找出有訂單但 property_id 為 null 或不在現有房型的訂單
  const matchedOrderNums = new Set(all.map((r: { order_number: string | null }) => r.order_number).filter(Boolean))
  const unmatched = bookingList.filter(b =>
    !matchedOrderNums.has(b.platform_booking_id) && (b.guest_name || b.platform_booking_id)
  ).map(b => ({
    guest_name: b.guest_name ?? '',
    order_number: b.platform_booking_id ?? '',
  }))

  return NextResponse.json({ rooms: all, unmatched })
}

// POST — 批次 upsert
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const rows = (Array.isArray(body) ? body : [body]).map((r, i) => ({
    user_id: user.id,
    date: r.date,
    room_name: r.room_name,
    room_password: r.room_password ?? null,
    gate_password: r.gate_password ?? null,
    order_number: r.order_number ?? null,
    guest_name: r.guest_name ?? null,
    source: r.source ?? 'manual',
    sort_order: r.sort_order ?? i,
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('bnb_daily_records')
    .upsert(rows, { onConflict: 'user_id,date,room_name' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH — 單筆更新
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // 密碼向後套用：更新該用戶 date >= from_date 的記錄（含當天）。
  // 大門密碼(gate_password)套用到所有房間；房門密碼(room_password)只套用同一房間。
  // 之後新建日期由 GET 的「昨日密碼繼承」自動延續。
  if (body.forward && body.from_date && (body.field === 'gate_password' || body.field === 'room_password')) {
    let q = supabase
      .from('bnb_daily_records')
      .update({ [body.field]: body.value ?? null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .gte('date', body.from_date)
    if (body.field === 'room_password' && body.room_name) q = q.eq('room_name', body.room_name)
    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('bnb_daily_records')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', user.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — 刪除單筆
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabase
    .from('bnb_daily_records')
    .delete()
    .eq('id', id).eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
