import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { sendBookingNotification } from '@/lib/booking/notify'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('public_bookings').select('*, properties(name)')
    .eq('host_user_id', user.id).order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bookings: data ?? [] })
}

// 確認 / 拒絕線上訂房申請（單一動作：確認＝轉正式訂單＋寄確認信；拒絕＝取消＋寄婉拒信）
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, action } = await req.json()
  if (!id || (action !== 'confirm' && action !== 'reject')) {
    return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  }

  const { data: pb } = await supabase
    .from('public_bookings').select('*').eq('id', id).eq('host_user_id', user.id).single()
  if (!pb) return NextResponse.json({ error: '訂單不存在' }, { status: 404 })

  const { data: profile } = await supabase
    .from('bnb_profiles').select('name,email,phone').eq('user_id', user.id).maybeSingle()

  if (action === 'reject') {
    await supabase.from('public_bookings').update({ status: 'cancelled' }).eq('id', id).eq('host_user_id', user.id)
    let emailed = false
    if (pb.guest_email && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: `${profile?.name ?? '民宿訂房系統'} <${process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'}>`,
          to: pb.guest_email,
          subject: `【訂房結果】很抱歉，無法確認您的 ${profile?.name ?? '民宿'} 訂房`,
          html: `<p>親愛的 <strong>${pb.guest_name ?? '旅客'}</strong> 您好，</p>
<p>很抱歉，您申請的 ${pb.check_in} ~ ${pb.check_out} 訂房目前無法確認，可能因該日期已滿房或其他因素。</p>
<p>如有疑問或想改其他日期，歡迎與我們聯繫：${profile?.phone ?? ''}</p>
<p>造成不便敬請見諒，期待未來有機會接待您。</p>`,
        })
        emailed = true
      } catch { /* 寄信失敗不阻斷拒絕動作 */ }
    }
    return NextResponse.json({ ok: true, status: 'cancelled', emailed })
  }

  // action === 'confirm'
  // 已轉過 → 冪等，不重複建立
  if (pb.converted_booking_id) {
    return NextResponse.json({ ok: true, status: 'confirmed', booking_id: pb.converted_booking_id, alreadyConverted: true })
  }

  // 1) 轉成正式訂單
  const { data: newBooking, error: insErr } = await supabase.from('bookings').insert({
    user_id: user.id,
    property_id: pb.property_id ?? null,
    platform: 'direct',
    guest_name: pb.guest_name,
    guest_email: pb.guest_email,
    guest_phone: pb.guest_phone ?? null,
    check_in: pb.check_in,
    check_out: pb.check_out,
    num_guests: pb.num_guests ?? 1,
    total_price: pb.total_price ?? null,
    status: 'confirmed',
    source: 'form',
    notes: pb.notes ?? null,
  }).select('id').single()

  if (insErr || !newBooking) {
    return NextResponse.json({ error: insErr?.message ?? '建立正式訂單失敗' }, { status: 500 })
  }

  // 2) 標記 public_booking 已確認並連結
  await supabase.from('public_bookings')
    .update({ status: 'confirmed', converted_booking_id: newBooking.id })
    .eq('id', id).eq('host_user_id', user.id)

  // 3) 優惠碼計次（僅在此確認時計一次）
  if (pb.promo_code) {
    await supabase.rpc('increment_promo_use', { p_user_id: user.id, p_code: pb.promo_code })
  }

  // 4) 寄確認信給旅客
  const mail = await sendBookingNotification(supabase, user.id, newBooking.id, 'confirmation')

  return NextResponse.json({ ok: true, status: 'confirmed', booking_id: newBooking.id, emailed: mail.ok })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status } = await req.json()
  const { data, error } = await supabase.from('public_bookings')
    .update({ status }).eq('id', id).eq('host_user_id', user.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ booking: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabase.from('public_bookings').delete().eq('id', id).eq('host_user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
