import { NextRequest, NextResponse } from 'next/server'
import { denyIfReadOnly, getCrmUser } from '@/lib/crm/auth'
import { nameKey, normalizeEmail, normalizePhone } from '@/lib/crm/normalize'

const LIST_SELECT = 'id, display_name, phone, email, tags, traits, order_count, total_spent, last_activity_at, crm_identities(kind, value, label), added_by_profile:profiles!crm_contacts_added_by_fkey(display_name:full_name, email)'

// GET /api/crm/contacts?q=&tag=&kind=line&page=0&sort=recent|name → 客人列表（含各平台帳號）
//   dup=1：只列出同名（可能重複）的客人，同名排在一起，並回傳 nameKey 供前端分組
//   same_as=<id>：列出與這位客人同名的其他客人（合併建議）
export async function GET(req: NextRequest) {
  const auth = await getCrmUser(req)
  if ('error' in auth) return auth.error
  const { supabase, own } = auth
  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim().replace(/[,()%]/g, ' ').slice(0, 80)
  const tag = sp.get('tag')
  const kind = sp.get('kind')
  const page = Math.max(0, Number(sp.get('page')) || 0)
  const size = 50
  const sort = sp.get('sort') === 'name' ? 'name' : 'recent'
  const dup = sp.get('dup') === '1'
  const sameAs = sp.get('same_as')

  // 同名比對要看整份名單（姓名順序、大小寫不同也算同名），在程式裡分組
  if (dup || sameAs) {
    const all: Record<string, unknown>[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('crm_contacts').select(LIST_SELECT).filter('owner_id', ...own).order('id').range(from, from + 999)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      all.push(...((data ?? []) as Record<string, unknown>[]))
      if (!data || data.length < 1000) break
    }
    const keyOf = (r: Record<string, unknown>) => nameKey(r.display_name as string | null)
    let list: Record<string, unknown>[]
    if (sameAs) {
      const target = all.find(r => r.id === sameAs)
      const k = target ? keyOf(target) : ''
      list = k ? all.filter(r => r.id !== sameAs && keyOf(r) === k) : []
    } else {
      const counts = new Map<string, number>()
      for (const r of all) { const k = keyOf(r); if (k) counts.set(k, (counts.get(k) ?? 0) + 1) }
      list = all.filter(r => (counts.get(keyOf(r)) ?? 0) > 1)
      if (q) list = list.filter(r => keyOf(r).includes(nameKey(q)))
      list.sort((a, b) => keyOf(a).localeCompare(keyOf(b)) || String(b.last_activity_at ?? '').localeCompare(String(a.last_activity_at ?? '')))
    }
    const pageRows = sameAs ? list.slice(0, 20) : list.slice(page * size, page * size + size)
    return NextResponse.json({
      contacts: pageRows.map(r => ({ ...r, name_key: keyOf(r) })),
      total: list.length, page, size, access: auth.access,
    })
  }

  let query = supabase
    .from('crm_contacts')
    .select(LIST_SELECT, { count: 'exact' })
    .filter('owner_id', ...own)
  query = (sort === 'name'
    ? query.order('display_name', { ascending: true, nullsFirst: false }).order('last_activity_at', { ascending: false, nullsFirst: false })
    : query.order('last_activity_at', { ascending: false, nullsFirst: false }))
    .range(page * size, page * size + size - 1)

  if (q) {
    const phone = normalizePhone(q)
    const ors = [`display_name.ilike.%${q}%`, `email.ilike.%${q.toLowerCase()}%`, `traits.ilike.%${q}%`, `notes.ilike.%${q}%`]
    if (phone) ors.push(`phone.ilike.%${phone.slice(-9)}%`)
    // 也可以直接用 LINE / WhatsApp 帳號 ID 搜尋
    const { data: hit } = await supabase.from('crm_identities').select('contact_id').filter('owner_id', ...own).ilike('value', `%${q}%`).limit(50)
    const ids = [...new Set((hit ?? []).map(h => h.contact_id))]
    if (ids.length) ors.push(`id.in.(${ids.join(',')})`)
    query = query.or(ors.join(','))
  }
  if (tag) query = query.contains('tags', [tag])
  if (kind) {
    const { data: hit } = await supabase.from('crm_identities').select('contact_id').filter('owner_id', ...own).eq('kind', kind).limit(1000)
    query = query.in('id', [...new Set((hit ?? []).map(h => h.contact_id))].concat('00000000-0000-0000-0000-000000000000'))
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // 總管理員可切換查看各公司的客人
  return NextResponse.json({ contacts: data ?? [], total: count ?? 0, page, size, access: auth.access })
}

// POST /api/crm/contacts → 手動新增客人
export async function POST(req: NextRequest) {
  const auth = await getCrmUser(req)
  if ('error' in auth) return auth.error
  const readOnly = denyIfReadOnly(auth.access)
  if (readOnly) return readOnly
  const { supabase, user, ownerId } = auth
  const body = await req.json().catch(() => ({}))
  const phone = normalizePhone(body.phone)
  const email = normalizeEmail(body.email)
  const name = typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 100) : null
  if (!name && !phone && !email) return NextResponse.json({ error: '至少填寫姓名、電話或 Email' }, { status: 400 })

  const { data: contact, error } = await supabase.from('crm_contacts')
    .insert({ owner_id: ownerId, added_by: user.id, display_name: name, phone, email, traits: body.traits ?? null, notes: body.notes ?? null, tags: Array.isArray(body.tags) ? body.tags : [] })
    .select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const idents = [phone && { kind: 'phone', value: phone }, email && { kind: 'email', value: email }].filter(Boolean) as { kind: string; value: string }[]
  if (idents.length) {
    await supabase.from('crm_identities').upsert(
      idents.map(i => ({ ...i, owner_id: ownerId, contact_id: contact.id, added_by: user.id })),
      { onConflict: 'owner_id,kind,value', ignoreDuplicates: true },
    )
  }
  return NextResponse.json({ id: contact.id })
}
