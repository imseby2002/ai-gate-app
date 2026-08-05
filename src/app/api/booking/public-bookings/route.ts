import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { Resend } from 'resend'
import { confirmPublicBooking } from '@/lib/booking/public-booking-confirm'

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('public_bookings').select('*, properties(name)')
    .eq('host_user_id', ctx.ownerId).order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bookings: data ?? [] })
}

// 確認 / 拒絕線上訂房申請（單一動作：確認＝轉正式訂單＋寄確認信；拒絕＝取消＋寄婉拒信）
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, action } = await req.json()
  if (!id || (action !== 'confirm' && action !== 'reject')) {
    return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  }

  const { data: pb } = await supabase
    .from('public_bookings').select('*').eq('id', id).eq('host_user_id', ctx.ownerId).single()
  if (!pb) return NextResponse.json({ error: '訂單不存在' }, { status: 404 })

  const { data: profile } = await supabase
    .from('bnb_profiles').select('name,email,phone').eq('user_id', ctx.ownerId).maybeSingle()

  if (action === 'reject') {
    await supabase.from('public_bookings').update({ status: 'cancelled' }).eq('id', id).eq('host_user_id', ctx.ownerId)
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
  const result = await confirmPublicBooking(supabase, ctx.ownerId, id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true, status: 'confirmed', booking_id: result.booking_id, emailed: result.emailed })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status } = await req.json()
  const { data, error } = await supabase.from('public_bookings')
    .update({ status }).eq('id', id).eq('host_user_id', ctx.ownerId).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ booking: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabase.from('public_bookings').delete().eq('id', id).eq('host_user_id', ctx.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
