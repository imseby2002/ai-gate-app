import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCrmUser } from '@/lib/crm/auth'
import { recomputeContacts } from '@/lib/crm/sync'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/crm/contacts/:id/merge { other_id } → 把 other 的帳號與紀錄全部併入 :id，並刪除 other
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await getCrmUser()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const otherId = String(body.other_id ?? '')
  if (!otherId || otherId === id) return NextResponse.json({ error: '請選擇要合併的另一位客人' }, { status: 400 })

  const { data: rows } = await supabase.from('crm_contacts').select('*').eq('owner_id', user.id).in('id', [id, otherId])
  const target = rows?.find(r => r.id === id)
  const other = rows?.find(r => r.id === otherId)
  if (!target || !other) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  const join = (a: string | null, b: string | null) => [a, b].filter(Boolean).join('\n') || null
  const patch = {
    display_name: target.display_name ?? other.display_name,
    phone: target.phone ?? other.phone,
    email: target.email ?? other.email,
    gender: target.gender ?? other.gender,
    birthday: target.birthday ?? other.birthday,
    country: target.country ?? other.country,
    tags: [...new Set([...(target.tags ?? []), ...(other.tags ?? [])])],
    traits: join(target.traits, other.traits),
    notes: join(target.notes, other.notes),
    ai_summary: target.ai_summary ?? other.ai_summary,
  }
  const steps = await Promise.all([
    supabase.from('crm_identities').update({ contact_id: id }).eq('contact_id', otherId).eq('owner_id', user.id),
    supabase.from('crm_activities').update({ contact_id: id }).eq('contact_id', otherId).eq('owner_id', user.id),
  ])
  const failed = steps.find(s => s.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })
  await supabase.from('crm_contacts').update(patch).eq('id', id)
  await supabase.from('crm_contacts').delete().eq('id', otherId).eq('owner_id', user.id)
  await recomputeContacts(supabase as unknown as SupabaseClient, user.id, new Map(), [id])
  return NextResponse.json({ ok: true })
}
