import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('bookings')
    .select('*, properties(id, name)')
    .eq('id', id)
    .eq('user_id', ctx.ownerId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // 一張訂單可能同時訂了多個不同房型（見 migration 090），這種情況下每個房型各自
  // 是一筆獨立的 bookings 資料列，只靠同一個 platform_booking_id 串起來——訂單詳情
  // 頁單看一筆會看不到「這張訂單其實還訂了別間房」，補上同單號的其他房型列表，
  // 讓使用者知道並可以點過去一起處理（例如整張訂單一起取消）。
  let siblings: unknown[] = []
  if (data.platform_booking_id) {
    const { data: sib } = await supabase
      .from('bookings')
      .select('id, total_price, status, properties(id, name)')
      .eq('user_id', ctx.ownerId)
      .eq('platform_booking_id', data.platform_booking_id)
      .neq('id', id)
    siblings = sib ?? []
  }

  return NextResponse.json({ booking: data, siblings })
}
