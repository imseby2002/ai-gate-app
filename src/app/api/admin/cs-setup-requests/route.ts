import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  return profile?.user_type === 'admin' ? user : null
}

const VALID_STATUS = ['pending', 'contacted', 'done']

// GET /api/admin/cs-setup-requests — 列出協助設定請求（含申請者 email）
export async function GET(req: NextRequest) {
  if (!await assertAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const status = req.nextUrl.searchParams.get('status')?.trim()
  const supabase = await createAdminClient()

  let query = supabase
    .from('cs_setup_requests')
    .select('id, owner_id, user_id, industry, contact, note, status, is_free, created_at, owner:profiles!owner_id(email, full_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (status && VALID_STATUS.includes(status)) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data ?? [] })
}

// PATCH /api/admin/cs-setup-requests — 更新請求狀態（pending / contacted / done）
export async function PATCH(req: NextRequest) {
  if (!await assertAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, status } = await req.json() as { id?: string; status?: string }
  if (!id || !status || !VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  }

  const supabase = await createAdminClient()
  const { error } = await supabase.from('cs_setup_requests').update({ status }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
