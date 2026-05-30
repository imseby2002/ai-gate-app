import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/booking/daily?date=2026-05-30
// 自動初始化：從 properties 補齊缺少的房間，帶入今日訂單 + 前一天密碼
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date')
    ?? new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

  // 昨日日期
  const prev = new Date(date)
  prev.setDate(prev.getDate() - 1)
  const prevDate = prev.toLocaleDateString('sv-SE')

  // 並行取得：本日記錄、所有房型、今日訂房、昨日記錄
  const [{ data: existing }, { data: properties }, { data: todayBookings }, { data: prevRecords }] =
    await Promise.all([
      supabase.from('bnb_daily_records').select('*').eq('user_id', user.id).eq('date', date).order('sort_order').order('room_name'),
      supabase.from('properties').select('id,name').eq('user_id', user.id).order('created_at'),
      supabase.from('bookings').select('property_id,guest_name,platform_booking_id,check_in').eq('user_id', user.id).eq('check_in', date).eq('status', 'confirmed'),
      supabase.from('bnb_daily_records').select('room_name,room_password,gate_password').eq('user_id', user.id).eq('date', prevDate),
    ])

  const existingList = existing ?? []
  const propList = properties ?? []
  const bookingList = todayBookings ?? []
  const prevList = prevRecords ?? []

  // 查詢用 map
  const existingNames = new Set(existingList.map((r: { room_name: string }) => r.room_name))
  const prevByRoom = Object.fromEntries(prevList.map((r: { room_name: string; room_password: string | null; gate_password: string | null }) => [r.room_name, r]))

  // booking 依 property_id 分組（一個房型當日可能有多筆，取第一筆）
  const bookingByPropId = Object.fromEntries(
    bookingList.map((b: { property_id: string; guest_name: string; platform_booking_id: string }) => [b.property_id, b])
  )

  // 找出尚未建立記錄的房型
  const missing = propList
    .filter((p: { id: string; name: string }) => !existingNames.has(p.name))
    .map((p: { id: string; name: string }, i: number) => {
      const booking = bookingByPropId[p.id]
      const prev = prevByRoom[p.name]
      return {
        user_id: user.id,
        date,
        room_name: p.name,
        room_password: prev?.room_password ?? null,   // 複製前一天密碼
        gate_password: prev?.gate_password ?? null,   // 複製前一天密碼
        order_number: booking?.platform_booking_id ?? null,
        guest_name: booking?.guest_name ?? null,
        source: booking ? 'booking' : 'manual',
        sort_order: existingList.length + i,
        updated_at: new Date().toISOString(),
      }
    })

  // 批次新增缺少的記錄
  let created: unknown[] = []
  if (missing.length > 0) {
    const { data } = await supabase
      .from('bnb_daily_records')
      .upsert(missing, { onConflict: 'user_id,date,room_name' })
      .select()
    created = data ?? []
  }

  // 同步更新現有記錄中尚無訂單的欄位（避免重複覆蓋手動填入）
  for (const rec of existingList) {
    const prop = propList.find((p: { id: string; name: string }) => p.name === rec.room_name)
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

  // 依房型管理順序排序後回傳
  const nameOrder = Object.fromEntries(propList.map((p: { name: string }, i: number) => [p.name, i]))
  const all = [...existingList, ...created]
  all.sort((a: { room_name: string }, b: { room_name: string }) =>
    (nameOrder[a.room_name] ?? 999) - (nameOrder[b.room_name] ?? 999)
  )

  return NextResponse.json(all)
}

// POST /api/booking/daily — 批次 upsert
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const rows = Array.isArray(body) ? body : [body]

  const upsertRows = rows.map((r: Record<string, unknown>, i: number) => ({
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
    .upsert(upsertRows, { onConflict: 'user_id,date,room_name' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/booking/daily — 單筆更新
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('bnb_daily_records')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/booking/daily — 刪除單筆
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabase
    .from('bnb_daily_records')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
