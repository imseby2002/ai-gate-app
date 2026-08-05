import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

// GET /api/booking/daily?date=2026-05-30
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date')
    ?? new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

  const prev = new Date(date)
  prev.setDate(prev.getDate() - 1)
  const prevDate = prev.toLocaleDateString('sv-SE')

  // 取得所有需要的資料
  const { data: existing } = await supabase
    .from('bnb_daily_records')
    .select('*')
    .eq('user_id', ctx.ownerId)
    .eq('date', date)
    .order('sort_order')
    .order('room_name')

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('user_id', ctx.ownerId)
    .order('created_at')

  const { data: todayBookings } = await supabase
    .from('bookings')
    .select('id, property_id, guest_name, platform_booking_id, check_in, total_price, platform, status')
    .eq('user_id', ctx.ownerId)
    .eq('check_in', date)
    .order('created_at')

  const { data: prevRecords } = await supabase
    .from('bnb_daily_records')
    .select('room_name, room_password, gate_password')
    .eq('user_id', ctx.ownerId)
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

  // 今日訂單依 property_id 分組（排除已取消，取消的訂單不該再被拿來自動帶入每日入住）
  const bookingByPropId: Record<string, { guest_name: string; platform_booking_id: string; total_price: number | null; platform: string | null }> = {}
  for (const b of bookingList) {
    if (b.status === 'cancelled') continue
    if (!bookingByPropId[b.property_id]) {
      bookingByPropId[b.property_id] = { guest_name: b.guest_name, platform_booking_id: b.platform_booking_id, total_price: b.total_price ?? null, platform: b.platform ?? null }
    }
  }

  // 訂單已取消時，同房型/同單號的每日入住舊資料也要跟著清掉，不能繼續顯示旅客早已取消的入住資訊。
  // 清掉後若同房型當天還有其他有效訂單，下方「補填」步驟會用新的 bookingByPropId 自動帶回正確資料。
  const cancelledOrderNumsByProp: Record<string, Set<string>> = {}
  for (const b of bookingList) {
    if (b.status !== 'cancelled' || !b.platform_booking_id) continue
    if (!cancelledOrderNumsByProp[b.property_id]) cancelledOrderNumsByProp[b.property_id] = new Set()
    cancelledOrderNumsByProp[b.property_id].add(b.platform_booking_id)
  }
  for (const rec of cleanList) {
    const prop = propList.find(p => p.name === rec.room_name)
    if (!prop || !rec.order_number) continue
    if (!cancelledOrderNumsByProp[prop.id]?.has(rec.order_number)) continue
    await supabase.from('bnb_daily_records').update({
      order_number: null, guest_name: null, price_total: null, platform: null,
      source: 'manual', updated_at: new Date().toISOString(),
    }).eq('id', rec.id)
    rec.order_number = null; rec.guest_name = null; rec.price_total = null; rec.platform = null; rec.source = 'manual'
  }

  // 新增缺少的房型記錄
  const missing = propList
    .filter(p => !existingNames.has(p.name))
    .map((p, i) => {
      const booking = bookingByPropId[p.id]
      const yesterday = prevByRoom[p.name]
      return {
        user_id: ctx.ownerId,
        date,
        room_name: p.name,
        room_password: yesterday?.room_password ?? null,
        gate_password: yesterday?.gate_password ?? null,
        order_number: booking?.platform_booking_id ?? null,
        guest_name: booking?.guest_name ?? null,
        price_total: booking?.total_price ?? null,
        platform: booking?.platform ?? null,
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
        price_total: rec.price_total ?? booking.total_price ?? null,
        platform: rec.platform ?? booking.platform ?? null,
        source: 'booking',
        updated_at: new Date().toISOString(),
      }).eq('id', rec.id)
      rec.order_number = booking.platform_booking_id ?? null
      rec.guest_name = booking.guest_name ?? null
      if (rec.price_total == null) rec.price_total = booking.total_price ?? null
      if (rec.platform == null) rec.platform = booking.platform ?? null
    }
  }

  // 依房型管理順序排序
  const nameOrder: Record<string, number> = {}
  propList.forEach((p, i) => { nameOrder[p.name] = i })

  const all = [...cleanList, ...created]
  all.sort((a: { room_name: string }, b: { room_name: string }) =>
    (nameOrder[a.room_name] ?? 999) - (nameOrder[b.room_name] ?? 999)
  )

  // 單號 → booking id 對照，讓每日入住可直接點進該筆訂單詳情。
  // 一張訂單可能訂了多個房型（見 migration 090），同一單號會對應多筆 bookings，
  // 所以除了單號本身，也要用「單號+房型」精準比對，避免連到別間房的訂單。
  const propIdByName: Record<string, string> = {}
  propList.forEach(p => { propIdByName[p.name] = p.id })

  const idByOrder: Record<string, string> = {}
  const idByOrderAndProp: Record<string, string> = {}
  for (const b of bookingList) {
    if (!b.platform_booking_id) continue
    idByOrder[b.platform_booking_id] = b.id
    if (b.property_id) idByOrderAndProp[`${b.platform_booking_id}::${b.property_id}`] = b.id
  }
  const allWithId = all.map((r: { order_number: string | null; room_name: string }) => {
    const propId = propIdByName[r.room_name]
    const preciseId = r.order_number && propId ? idByOrderAndProp[`${r.order_number}::${propId}`] : null
    return {
      ...r,
      booking_id: preciseId ?? (r.order_number ? (idByOrder[r.order_number] ?? null) : null),
    }
  })

  // 找出有訂單但 property_id 為 null 或不在現有房型的訂單
  const matchedOrderNums = new Set(all.map((r: { order_number: string | null }) => r.order_number).filter(Boolean))
  const unmatched = bookingList.filter(b =>
    !matchedOrderNums.has(b.platform_booking_id) && (b.guest_name || b.platform_booking_id)
  ).map(b => ({
    guest_name: b.guest_name ?? '',
    order_number: b.platform_booking_id ?? '',
    booking_id: b.id ?? null,
  }))

  return NextResponse.json({ rooms: allWithId, unmatched })
}

// POST — 批次 upsert
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const rows = (Array.isArray(body) ? body : [body]).map((r, i) => ({
    user_id: ctx.ownerId,
    date: r.date,
    room_name: r.room_name,
    room_password: r.room_password ?? null,
    gate_password: r.gate_password ?? null,
    order_number: r.order_number ?? null,
    guest_name: r.guest_name ?? null,
    price_total: r.price_total ?? null,
    deposit: r.deposit ?? null,
    paid: r.paid ?? false,
    platform: r.platform ?? null,
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
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // 密碼向後套用：更新該用戶 date >= from_date 的記錄（含當天）。
  // 大門密碼(gate_password)套用到所有房間；房門密碼(room_password)只套用同一房間。
  // 之後新建日期由 GET 的「昨日密碼繼承」自動延續。
  if (body.forward && body.from_date && (body.field === 'gate_password' || body.field === 'room_password')) {
    let q = supabase
      .from('bnb_daily_records')
      .update({ [body.field]: body.value ?? null, updated_at: new Date().toISOString() })
      .eq('user_id', ctx.ownerId)
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
    .eq('id', id).eq('user_id', ctx.ownerId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 訂單相關欄位（旅客／房價／平台）在每日入住手動修正時，同步寫回對應的 bookings，
  // 讓「訂單管理」與「日曆」畫面顯示一致。
  const BOOKING_FIELDS = ['guest_name', 'price_total', 'platform'] as const
  const changedKeys = BOOKING_FIELDS.filter(f => f in updates)
  if (changedKeys.length > 0 && data) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (changedKeys.includes('guest_name')) patch.guest_name = data.guest_name ?? null
    if (changedKeys.includes('price_total')) patch.total_price = data.price_total ?? null
    if (changedKeys.includes('platform')) patch.platform = data.platform ?? 'manual'

    // 一張訂單可能訂了多個房型（見 migration 090），同一單號可能對應多筆 bookings，
    // 所以有單號時也要搭配房型一起比對，才能唯一鎖定「這個房間」的那一筆訂單。
    const { data: prop } = await supabase
      .from('properties')
      .select('id')
      .eq('user_id', ctx.ownerId)
      .eq('name', data.room_name)
      .maybeSingle()

    if (data.order_number && prop) {
      const { data: matched } = await supabase
        .from('bookings')
        .select('id')
        .eq('user_id', ctx.ownerId)
        .eq('platform_booking_id', data.order_number)
        .eq('property_id', prop.id)
        .maybeSingle()
      if (matched) {
        await supabase.from('bookings').update(patch).eq('id', matched.id).eq('user_id', ctx.ownerId)
      }
    } else if (!data.order_number) {
      // 無單號：只有「房型+日期」剛好唯一對應一筆訂單時才連動，
      // 避免房型下有多間房、同天多筆訂單時誤改到別人的資料
      if (prop) {
        const { data: candidates } = await supabase
          .from('bookings')
          .select('id')
          .eq('user_id', ctx.ownerId)
          .eq('property_id', prop.id)
          .eq('check_in', data.date)
          .limit(2)

        if (candidates && candidates.length === 1) {
          await supabase.from('bookings').update(patch).eq('id', candidates[0].id).eq('user_id', ctx.ownerId)
        } else if (!candidates?.length && (data.guest_name || data.price_total != null)) {
          const checkOut = new Date(data.date)
          checkOut.setDate(checkOut.getDate() + 1)
          await supabase.from('bookings').insert({
            user_id: ctx.ownerId,
            property_id: prop.id,
            platform: data.platform ?? 'manual',
            guest_name: data.guest_name ?? null,
            check_in: data.date,
            check_out: checkOut.toLocaleDateString('sv-SE'),
            num_guests: 1,
            total_price: data.price_total ?? null,
            currency: 'TWD',
            status: 'confirmed',
            source: 'manual',
          })
        }
      }
    }
  }

  return NextResponse.json(data)
}

// DELETE — 刪除單筆
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabase
    .from('bnb_daily_records')
    .delete()
    .eq('id', id).eq('user_id', ctx.ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
