import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

// 已匯入資料中出現過的門市清單
export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: a }, { data: b }] = await Promise.all([
    supabase.from('inv_movements').select('store').eq('owner_id', user.id),
    supabase.from('inv_pos_sales').select('store').eq('owner_id', user.id),
  ])
  const set = new Set<string>()
  for (const r of [...(a ?? []), ...(b ?? [])]) if (r.store) set.add(r.store)
  return NextResponse.json({ stores: [...set].sort() })
}
