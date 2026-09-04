import { NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { genCode } from '@/lib/hr/apply'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

// 取得（或建立）公司公開應徵代碼
export async function GET() {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

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
