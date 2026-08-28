import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  let q = supabase.from('hr_attendance').select('*').eq('owner_id', user.id)
  if (year) q = q.eq('year', parseInt(year))
  if (month) q = q.eq('month', parseInt(month))
  const { data, error } = await q.order('store', { ascending: true }).order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attendance: data ?? [] })
}

// 編輯手動補登（adjust_hours / adjust_note）
export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, adjust_hours, adjust_note } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (adjust_hours !== undefined) patch.adjust_hours = Number(adjust_hours) || 0
  if (adjust_note !== undefined) patch.adjust_note = String(adjust_note ?? '')

  const { data, error } = await supabase
    .from('hr_attendance').update(patch).eq('id', id).eq('owner_id', user.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attendance: data })
}
