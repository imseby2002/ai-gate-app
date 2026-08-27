import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 目前登入者可存取的單位（供 /office 分群過濾）。任何登入者皆可呼叫。
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('user_type, units').eq('id', user.id).single()
  const isAdmin = profile?.user_type === 'admin'
  return NextResponse.json({ isAdmin, units: profile?.units ?? [] })
}
