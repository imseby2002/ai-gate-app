import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { genCode } from '@/lib/hr/apply'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

// 取得（或建立）公司公開應徵代碼
export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing } = await supabase
    .from('hr_settings').select('apply_code').eq('owner_id', user.id).single()
  let code = existing?.apply_code
  if (!code) {
    code = genCode()
    const { error } = await supabase.from('hr_settings')
      .upsert({ owner_id: user.id, apply_code: code, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ code })
}
