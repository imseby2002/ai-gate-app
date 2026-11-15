import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCrmUser } from '@/lib/crm/auth'
import { recomputeContacts } from '@/lib/crm/sync'
import { mergeContacts } from '@/lib/crm/merge'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/crm/contacts/:id/merge { other_id } → 把 other 的帳號與紀錄全部併入 :id，並刪除 other
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await getCrmUser(req)
  if ('error' in auth) return auth.error
  const { supabase, ownerId, own } = auth
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const otherId = String(body.other_id ?? '')
  if (!otherId || otherId === id) return NextResponse.json({ error: '請選擇要合併的另一位客人' }, { status: 400 })

  const { data: rows } = await supabase.from('crm_contacts').select('*').filter('owner_id', ...own).in('id', [id, otherId])
  if (rows?.length !== 2) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  try {
    await mergeContacts(supabase, ownerId, id, otherId)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '合併失敗' }, { status: 500 })
  }
  await recomputeContacts(supabase as unknown as SupabaseClient, ownerId, new Map(), [id])
  return NextResponse.json({ ok: true })
}
