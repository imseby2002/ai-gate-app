import { NextRequest, NextResponse } from 'next/server'
import { getCrmUser } from '@/lib/crm/auth'
import { normalizeEmail, normalizePhone } from '@/lib/crm/normalize'

// GET /api/crm/contacts?q=&tag=&kind=line&page=0 → 客人列表（含各平台帳號）
export async function GET(req: NextRequest) {
  const auth = await getCrmUser()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth
  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim().replace(/[,()%]/g, ' ').slice(0, 80)
  const tag = sp.get('tag')
  const kind = sp.get('kind')
  const page = Math.max(0, Number(sp.get('page')) || 0)
  const size = 50

  let query = supabase
    .from('crm_contacts')
    .select('id, display_name, phone, email, tags, traits, order_count, total_spent, last_activity_at, crm_identities(kind, value, label)', { count: 'exact' })
    .eq('owner_id', user.id)
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .range(page * size, page * size + size - 1)

  if (q) {
    const phone = normalizePhone(q)
    const ors = [`display_name.ilike.%${q}%`, `email.ilike.%${q.toLowerCase()}%`, `traits.ilike.%${q}%`, `notes.ilike.%${q}%`]
    if (phone) ors.push(`phone.ilike.%${phone.slice(-9)}%`)
    // 也可以直接用 LINE / WhatsApp 帳號 ID 搜尋
    const { data: hit } = await supabase.from('crm_identities').select('contact_id').eq('owner_id', user.id).ilike('value', `%${q}%`).limit(50)
    const ids = [...new Set((hit ?? []).map(h => h.contact_id))]
    if (ids.length) ors.push(`id.in.(${ids.join(',')})`)
    query = query.or(ors.join(','))
  }
  if (tag) query = query.contains('tags', [tag])
  if (kind) {
    const { data: hit } = await supabase.from('crm_identities').select('contact_id').eq('owner_id', user.id).eq('kind', kind).limit(1000)
    query = query.in('id', [...new Set((hit ?? []).map(h => h.contact_id))].concat('00000000-0000-0000-0000-000000000000'))
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contacts: data ?? [], total: count ?? 0, page, size })
}

// POST /api/crm/contacts → 手動新增客人
export async function POST(req: NextRequest) {
  const auth = await getCrmUser()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth
  const body = await req.json().catch(() => ({}))
  const phone = normalizePhone(body.phone)
  const email = normalizeEmail(body.email)
  const name = typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 100) : null
  if (!name && !phone && !email) return NextResponse.json({ error: '至少填寫姓名、電話或 Email' }, { status: 400 })

  const { data: contact, error } = await supabase.from('crm_contacts')
    .insert({ owner_id: user.id, display_name: name, phone, email, traits: body.traits ?? null, notes: body.notes ?? null, tags: Array.isArray(body.tags) ? body.tags : [] })
    .select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const idents = [phone && { kind: 'phone', value: phone }, email && { kind: 'email', value: email }].filter(Boolean) as { kind: string; value: string }[]
  if (idents.length) {
    await supabase.from('crm_identities').upsert(
      idents.map(i => ({ ...i, owner_id: user.id, contact_id: contact.id })),
      { onConflict: 'owner_id,kind,value', ignoreDuplicates: true },
    )
  }
  return NextResponse.json({ id: contact.id })
}
