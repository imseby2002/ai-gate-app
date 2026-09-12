import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { findOrCreateOrder } from '@/lib/booking/orders'

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('sv-SE')
}

function generateDailyOrderNumber(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  const datePart = `${(y || '').slice(2)}${m || ''}${d || ''}`
  const randPart = Math.floor(1000 + Math.random() * 9000).toString()
  return `M${datePart}-${randPart}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolvePasswordsForDate(
  supabase: any,
  userId: string,
  targetDate: string,
  propNames: string[]
): Promise<{ gatePassword: string | null; roomPasswords: Record<string, string | null> }> {
  // 1. 大門密碼：優先找 <= targetDate 最近一筆非空密碼（全棟共用）
  const { data: latestGate } = await supabase
    .from('bnb_daily_records')
    .select('gate_password')
    .eq('user_id', userId)
    .lte('date', targetDate)
    .not('gate_password', 'is', null)
    .neq('gate_password', '')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  let gatePassword = latestGate?.gate_password ? latestGate.gate_password.trim() : null
  if (!gatePassword) {
    const { data: anyGate } = await supabase
      .from('bnb_daily_records')
      .select('gate_password')
      .eq('user_id', userId)
      .not('gate_password', 'is', null)
      .neq('gate_password', '')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    gatePassword = anyGate?.gate_password ? anyGate.gate_password.trim() : null
  }

  // 2. 各房間獨立密碼：優先找 <= targetDate 該房間最近一筆非空密碼
  const roomPasswords: Record<string, string | null> = {}
  for (const name of propNames) {
    const { data: latestRoom } = await supabase
      .from('bnb_daily_records')
      .select('room_password')
      .eq('user_id', userId)
      .eq('room_name', name)
      .lte('date', targetDate)
      .not('room_password', 'is', null)
      .neq('room_password', '')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    let roomPwd = latestRoom?.room_password ? latestRoom.room_password.trim() : null
    if (!roomPwd) {
      const { data: anyRoom } = await supabase
        .from('bnb_daily_records')
        .select('room_password')
        .eq('user_id', userId)
        .eq('room_name', name)
        .not('room_password', 'is', null)
        .neq('room_password', '')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()
      roomPwd = anyRoom?.room_password ? anyRoom.room_password.trim() : null
    }
    roomPasswords[name] = roomPwd
  }

  return { gatePassword, roomPasswords }
}

// GET /api/booking/daily?date=2026-05-30
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date')
    ?? new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

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

  // 涵蓋當晚的訂單，不是只找「今天入住」的——續住多晚的旅客，第二晚起也要能自動帶入，
  // 不必每天手動重填（退房當天不算佔用，所以用 check_out > date）。
  const { data: todayBookings } = await supabase
    .from('bookings')
    .select('id, property_id, guest_name, platform_booking_id, check_in, check_out, total_price, platform, status, deposit_amount, is_paid')
    .eq('user_id', ctx.ownerId)
    .lte('check_in', date)
    .gt('check_out', date)
    .order('created_at')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingList: any[] = existing ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const propList: any[] = properties ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookingList: any[] = todayBookings ?? []

  // 取得該日期應對應的密碼（若該日未填或中斷，自動回溯繼承最近設定，絕不遺失）
  const validNames = new Set(propList.map(p => p.name as string))
  const resolvedPw = await resolvePasswordsForDate(supabase, ctx.ownerId, date, Array.from(validNames))

  // 清理不再 properties 的無效空白記錄（已刪除房型且完全無實質資料者；有資料或密碼的保留）
  const stale = existingList.filter(r => !validNames.has(r.room_name))
  const staleToDelete = stale.filter(r => !r.order_number && !r.guest_name && !r.booking_id && !r.room_password && !r.gate_password)
  if (staleToDelete.length > 0) {
    await supabase.from('bnb_daily_records')
      .delete()
      .in('id', staleToDelete.map(r => r.id))
  }
  const cleanList = existingList.filter(r => validNames.has(r.room_name))

  const existingNames = new Set(cleanList.map(r => r.room_name as string))

  // 自動修復既有記錄中遺失的密碼（若為空則套用回溯密碼，並背景持久化）
  for (const rec of cleanList) {
    let pwChanged = false
    const pwPatch: Record<string, string> = {}
    if (!rec.gate_password && resolvedPw.gatePassword) {
      rec.gate_password = resolvedPw.gatePassword
      pwPatch.gate_password = resolvedPw.gatePassword
      pwChanged = true
    }
    if (!rec.room_password && resolvedPw.roomPasswords[rec.room_name]) {
      rec.room_password = resolvedPw.roomPasswords[rec.room_name]
      pwPatch.room_password = resolvedPw.roomPasswords[rec.room_name]
      pwChanged = true
    }
    if (pwChanged) {
      await supabase.from('bnb_daily_records').update({ ...pwPatch, updated_at: new Date().toISOString() }).eq('id', rec.id)
    }
  }

  // 今日訂單依 property_id 分組（排除已取消，取消的訂單不該再被拿來自動帶入每日入住）
  const bookingByPropId: Record<string, { id: string; guest_name: string; platform_booking_id: string; total_price: number | null; platform: string | null; deposit_amount: number | null; is_paid: boolean }> = {}
  for (const b of bookingList) {
    if (b.status === 'cancelled') continue
    if (!bookingByPropId[b.property_id]) {
      bookingByPropId[b.property_id] = {
        id: b.id,
        guest_name: b.guest_name, platform_booking_id: b.platform_booking_id,
        total_price: b.total_price ?? null, platform: b.platform ?? null,
        deposit_amount: b.deposit_amount ?? null, is_paid: b.is_paid ?? false,
      }
    }
  }

  // 每日入住的訂單欄位（單號/姓名/房價/平台）只該反映「目前仍有效」的訂單。
  // 有 booking_id（跟訂單直接連結過）時直接檢查那筆訂單是否還存在、仍涵蓋今天、
  // 沒被取消，精準不會猜錯；沒有 booking_id 的舊資料才退回原本「單號+房型」軟比對。
  // 只要判定對不到任何一筆目前有效訂單，一律清掉（含 booking_id）；若清掉後同房型
  // 當天還有其他有效訂單，下方「補填」步驟會自動帶回正確資料。
  const activeBookingIds = new Set(bookingList.filter(b => b.status !== 'cancelled').map(b => b.id))
  const validOrderNumsByProp: Record<string, Set<string>> = {}
  const validPropIds = new Set<string>()
  for (const b of bookingList) {
    if (b.status === 'cancelled') continue
    validPropIds.add(b.property_id)
    if (b.platform_booking_id) {
      if (!validOrderNumsByProp[b.property_id]) validOrderNumsByProp[b.property_id] = new Set()
      validOrderNumsByProp[b.property_id].add(b.platform_booking_id)
    }
  }
  for (const rec of cleanList) {
    if (!rec.booking_id && rec.source !== 'booking') continue
    let stillValid: boolean
    if (rec.booking_id) {
      stillValid = activeBookingIds.has(rec.booking_id)
    } else {
      const prop = propList.find(p => p.name === rec.room_name)
      if (!prop) continue
      stillValid = rec.order_number
        ? !!validOrderNumsByProp[prop.id]?.has(rec.order_number)
        : validPropIds.has(prop.id)
    }
    if (stillValid) continue
    await supabase.from('bnb_daily_records').update({
      order_number: null, guest_name: null, price_total: null, platform: null,
      deposit: null, paid: false, booking_id: null,
      source: 'manual', updated_at: new Date().toISOString(),
    }).eq('id', rec.id)
    rec.order_number = null; rec.guest_name = null; rec.price_total = null; rec.platform = null
    rec.deposit = null; rec.paid = false; rec.source = 'manual'; rec.booking_id = null
  }

  // 新增缺少的房型記錄
  const missing = propList
    .filter(p => !existingNames.has(p.name))
    .map((p, i) => {
      const booking = bookingByPropId[p.id]
      return {
        user_id: ctx.ownerId,
        date,
        room_name: p.name,
        room_password: resolvedPw.roomPasswords[p.name] ?? null,
        gate_password: resolvedPw.gatePassword ?? null,
        order_number: booking?.platform_booking_id ?? null,
        guest_name: booking?.guest_name ?? null,
        price_total: booking?.total_price ?? null,
        platform: booking?.platform ?? null,
        deposit: booking?.deposit_amount ?? null,
        paid: booking?.is_paid ?? false,
        booking_id: booking?.id ?? null,
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
        deposit: rec.deposit ?? booking.deposit_amount ?? null,
        paid: rec.paid || booking.is_paid,
        booking_id: booking.id,
        source: 'booking',
        updated_at: new Date().toISOString(),
      }).eq('id', rec.id)
      rec.order_number = booking.platform_booking_id ?? null
      rec.guest_name = booking.guest_name ?? null
      if (rec.price_total == null) rec.price_total = booking.total_price ?? null
      if (rec.platform == null) rec.platform = booking.platform ?? null
      if (rec.deposit == null) rec.deposit = booking.deposit_amount ?? null
      rec.paid = rec.paid || booking.is_paid
      rec.booking_id = booking.id
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
  const allWithId = all.map((r: { order_number: string | null; room_name: string; booking_id: string | null }) => {
    const propId = propIdByName[r.room_name]
    const preciseId = r.order_number && propId ? idByOrderAndProp[`${r.order_number}::${propId}`] : null
    return {
      ...r,
      // 已經有真正連結的 booking_id 就直接用；沒有才退回單號比對出來的猜測值。
      booking_id: r.booking_id ?? preciseId ?? (r.order_number ? (idByOrder[r.order_number] ?? null) : null),
    }
  })

  // 找出有訂單但 property_id 為 null 或不在現有房型的訂單（已取消的訂單不算未對應，不該再顯示）
  const matchedOrderNums = new Set(all.map((r: { order_number: string | null }) => r.order_number).filter(Boolean))
  const unmatched = bookingList.filter(b =>
    b.status !== 'cancelled' && !matchedOrderNums.has(b.platform_booking_id) && (b.guest_name || b.platform_booking_id)
  ).map(b => ({
    guest_name: b.guest_name ?? '',
    order_number: b.platform_booking_id ?? '',
    booking_id: b.id ?? null,
    platform: b.platform ?? null,
    check_in: b.check_in ?? null,
    check_out: b.check_out ?? null,
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

  // 續住：把前一天同房間的訂單資料（單號/旅客/房價/訂金/已付款/平台）帶入今天，
  // 若前一天有連動到訂單，同時把該訂單的退房日往後延一晚，讓這筆訂單本身就涵蓋今天，
  // 之後每一晚也會自動帶入，不用每天手動按續住。
  if (body.action === 'continue' && body.id) {
    const { data: today } = await supabase
      .from('bnb_daily_records')
      .select('*')
      .eq('id', body.id).eq('user_id', ctx.ownerId)
      .maybeSingle()
    if (!today) return NextResponse.json({ error: '找不到此記錄' }, { status: 404 })

    const yDate = addDaysStr(today.date, -1)
    const { data: yesterday } = await supabase
      .from('bnb_daily_records')
      .select('*')
      .eq('user_id', ctx.ownerId).eq('date', yDate).eq('room_name', today.room_name)
      .maybeSingle()

    if (!yesterday || (!yesterday.order_number && !yesterday.guest_name)) {
      return NextResponse.json({ error: '前一天沒有可帶入的入住資料' }, { status: 400 })
    }

    let linkedBooking = false
    let linkedBookingId: string | null = null
    const newCheckout = addDaysStr(today.date, 1)

    // 昨天已經跟訂單連結過：直接用 booking_id 延退房日，不必再靠單號猜。
    if (yesterday.booking_id) {
      const { data: b } = await supabase
        .from('bookings').select('id, check_out')
        .eq('id', yesterday.booking_id).eq('user_id', ctx.ownerId)
        .neq('status', 'cancelled')
        .maybeSingle()
      if (b) {
        linkedBooking = true
        linkedBookingId = b.id
        if (b.check_out <= today.date) {
          await supabase.from('bookings').update({ check_out: newCheckout, updated_at: new Date().toISOString() }).eq('id', b.id)
        }
      }
    }

    if (!linkedBooking) {
      const { data: prop } = await supabase
        .from('properties')
        .select('id')
        .eq('user_id', ctx.ownerId)
        .eq('name', today.room_name)
        .maybeSingle()

      if (prop) {
        if (yesterday.order_number) {
          const { data: b } = await supabase
            .from('bookings').select('id, check_out')
            .eq('user_id', ctx.ownerId).eq('property_id', prop.id)
            .eq('platform_booking_id', yesterday.order_number)
            .neq('status', 'cancelled')
            .maybeSingle()
          if (b) {
            linkedBooking = true
            linkedBookingId = b.id
            if (b.check_out <= today.date) {
              await supabase.from('bookings').update({ check_out: newCheckout, updated_at: new Date().toISOString() }).eq('id', b.id)
            }
          }
        } else {
          const { data: b } = await supabase
            .from('bookings').select('id, check_out')
            .eq('user_id', ctx.ownerId).eq('property_id', prop.id)
            .is('platform_booking_id', null).eq('check_out', today.date)
            .neq('status', 'cancelled')
            .maybeSingle()
          if (b) {
            linkedBooking = true
            linkedBookingId = b.id
            await supabase.from('bookings').update({ check_out: newCheckout, updated_at: new Date().toISOString() }).eq('id', b.id)
          }
        }
      }
    }

    const { data: updated, error } = await supabase
      .from('bnb_daily_records')
      .update({
        order_number: yesterday.order_number, guest_name: yesterday.guest_name,
        price_total: yesterday.price_total, deposit: yesterday.deposit, paid: yesterday.paid,
        platform: yesterday.platform, source: linkedBooking ? 'booking' : yesterday.source,
        booking_id: linkedBookingId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id).eq('user_id', ctx.ownerId)
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(updated)
  }

  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // 找對應訂單一律要用「更新前」的資料比對——若這次改的正是單號本身，
  // 用更新後的新單號去找舊訂單一定找不到。
  const { data: before } = await supabase
    .from('bnb_daily_records')
    .select('order_number, room_name, date, booking_id, guest_name, price_total, deposit, paid, platform')
    .eq('id', id).eq('user_id', ctx.ownerId)
    .maybeSingle()

  if (!before) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('bnb_daily_records')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', ctx.ownerId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 訂單相關欄位（單號／旅客／房價／訂金／付款／平台）在每日入住手動修正時，
  // 同步寫回對應的 bookings 與 booking_orders，讓「訂單管理」「日曆」「訂單詳情」都跟每日入住一致。
  const BOOKING_FIELDS = ['order_number', 'guest_name', 'price_total', 'deposit', 'paid', 'platform'] as const
  const changedKeys = BOOKING_FIELDS.filter(f => f in updates)
  if (changedKeys.length > 0 && data && before) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (changedKeys.includes('order_number')) patch.platform_booking_id = data.order_number ?? null
    if (changedKeys.includes('guest_name')) patch.guest_name = data.guest_name ?? null
    if (changedKeys.includes('price_total')) patch.total_price = data.price_total ?? null
    if (changedKeys.includes('deposit')) patch.deposit_amount = data.deposit ?? null
    if (changedKeys.includes('paid')) patch.is_paid = !!data.paid
    if (changedKeys.includes('platform')) patch.platform = data.platform ?? 'manual'

    // 已經連結過訂單（有 booking_id）：直接改那一筆
    if (before.booking_id) {
      const isCleared = !data.guest_name && data.price_total == null && !data.order_number && data.deposit == null && !data.paid
      if (isCleared) {
        await supabase.from('bookings').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', before.booking_id).eq('user_id', ctx.ownerId)
        await supabase.from('bnb_daily_records').update({ booking_id: null, source: 'manual', updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', ctx.ownerId)
        data.booking_id = null
        data.source = 'manual'
      } else {
        const { data: b } = await supabase
          .from('bookings')
          .update(patch)
          .eq('id', before.booking_id)
          .eq('user_id', ctx.ownerId)
          .select('order_id')
          .maybeSingle()

        if (b?.order_id) {
          const orderPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
          if (changedKeys.includes('order_number') && data.order_number) orderPatch.platform_booking_id = data.order_number
          if (changedKeys.includes('guest_name')) orderPatch.guest_name = data.guest_name ?? null
          if (changedKeys.includes('deposit')) orderPatch.deposit_amount = data.deposit ?? null
          if (changedKeys.includes('paid')) orderPatch.is_paid = !!data.paid
          if (changedKeys.includes('platform')) orderPatch.platform = data.platform ?? 'manual'
          await supabase.from('booking_orders').update(orderPatch).eq('id', b.order_id).eq('user_id', ctx.ownerId)
        }
      }
    } else {
      // 還沒連結過：比對既有或新建
      const { data: prop } = await supabase
        .from('properties')
        .select('id')
        .eq('user_id', ctx.ownerId)
        .eq('name', data.room_name)
        .maybeSingle()

      let linkedId: string | null = null

      if (prop) {
        const targetOrderNum = data.order_number || before.order_number
        if (targetOrderNum) {
          const { data: matched } = await supabase
            .from('bookings')
            .select('id')
            .eq('user_id', ctx.ownerId)
            .eq('platform_booking_id', targetOrderNum)
            .eq('property_id', prop.id)
            .neq('status', 'cancelled')
            .maybeSingle()
          if (matched) {
            await supabase.from('bookings').update(patch).eq('id', matched.id).eq('user_id', ctx.ownerId)
            linkedId = matched.id
          }
        }

        if (!linkedId && !targetOrderNum) {
          const { data: candidates } = await supabase
            .from('bookings')
            .select('id')
            .eq('user_id', ctx.ownerId)
            .eq('property_id', prop.id)
            .eq('check_in', data.date)
            .neq('status', 'cancelled')
            .limit(2)

          if (candidates && candidates.length === 1) {
            await supabase.from('bookings').update(patch).eq('id', candidates[0].id).eq('user_id', ctx.ownerId)
            linkedId = candidates[0].id
          }
        }

        // 不論這格有沒有填單號，只要上面找不到可連結的既有訂單、這格又已經填了
        // 實質內容（旅客姓名、金額、單號、訂金或付款），就自動形成訂單並同步日曆！
        const hasContent = !!(
          (data.guest_name && data.guest_name.trim()) ||
          data.price_total != null ||
          (data.order_number && data.order_number.trim()) ||
          data.deposit != null ||
          data.paid
        )

        if (!linkedId && hasContent) {
          const checkOut = new Date(data.date)
          checkOut.setDate(checkOut.getDate() + 1)
          const checkOutStr = checkOut.toLocaleDateString('sv-SE')

          const finalOrderNum = (data.order_number && data.order_number.trim())
            ? data.order_number.trim()
            : generateDailyOrderNumber(data.date)

          const orderId = await findOrCreateOrder(
            supabase,
            ctx.ownerId,
            data.platform ?? 'manual',
            finalOrderNum,
            {
              guest_name: data.guest_name ?? null,
              deposit_amount: data.deposit ?? null,
              is_paid: !!data.paid,
              source: 'manual',
            }
          )

          const { data: created, error: insertErr } = await supabase
            .from('bookings')
            .insert({
              user_id: ctx.ownerId,
              order_id: orderId,
              property_id: prop.id,
              platform: data.platform ?? 'manual',
              platform_booking_id: finalOrderNum,
              guest_name: data.guest_name ?? null,
              check_in: data.date,
              check_out: checkOutStr,
              num_guests: 1,
              total_price: data.price_total ?? null,
              deposit_amount: data.deposit ?? null,
              is_paid: !!data.paid,
              currency: 'TWD',
              status: 'confirmed',
              source: 'manual',
            })
            .select('id')
            .single()

          if (insertErr) {
            console.error('[daily/PATCH] bookings insert error:', insertErr)
          } else if (created?.id) {
            linkedId = created.id
            data.order_number = finalOrderNum
          }
        }
      }

      if (linkedId) {
        await supabase
          .from('bnb_daily_records')
          .update({
            booking_id: linkedId,
            order_number: data.order_number,
            source: 'booking',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', ctx.ownerId)

        data.booking_id = linkedId
        data.source = 'booking'
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
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: rec } = await supabase
    .from('bnb_daily_records')
    .select('booking_id')
    .eq('id', id)
    .eq('user_id', ctx.ownerId)
    .maybeSingle()

  if (rec?.booking_id) {
    await supabase
      .from('bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', rec.booking_id)
      .eq('user_id', ctx.ownerId)
  }

  const { error } = await supabase
    .from('bnb_daily_records')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
