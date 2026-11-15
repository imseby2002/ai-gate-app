// 客戶系統（CRM）同步：把 RESERVE 預約、BOOKING 訂房、eSIM 訂單、AI 客服對話的客人
// 彙整進 crm_contacts / crm_identities / crm_activities。
//
// 比對規則：同一位擁有者底下，電話（正規化）、Email（小寫）、平台帳號（LINE/WhatsApp…）
// 任一相同即視為同一位客人。已屬於另一位客人的身分不會被自動搶走（避免誤合併），
// 需要合併時由使用者在客戶頁手動「合併」。
// 資料列來自未產生型別的 Supabase 查詢（跨多張既有資料表），此檔以 any 讀取欄位。
/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { csPlatformToKind, normalizeEmail, normalizePhone, type IdentityKind } from './normalize'

type Ident = { kind: IdentityKind; value: string; label?: string | null; cs_customer_id?: string | null }

interface SourceRecord {
  source: 'reserve' | 'booking' | 'esim' | 'cs'
  source_id: string
  kind: 'appointment' | 'stay' | 'purchase' | 'conversation'
  title: string
  amount: number | null
  currency?: string
  status: string | null
  occurred_at: string
  meta: Record<string, unknown>
  name: string | null
  idents: Ident[]
  summary?: string | null
}

const EXCLUDED_STATUS = new Set(['cancelled', 'canceled', 'no_show', 'refunded', 'failed', 'pending_payment'])
const PAGE = 1000

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

function baseIdents(phone: unknown, email: unknown): Ident[] {
  const ids: Ident[] = []
  const p = normalizePhone(phone)
  const e = normalizeEmail(email)
  if (p) ids.push({ kind: 'phone', value: p })
  if (e) ids.push({ kind: 'email', value: e })
  return ids
}

async function loadReserve(db: SupabaseClient, ownerId: string): Promise<SourceRecord[]> {
  const { data: stores } = await db.from('reserve_stores').select('id, name').eq('user_id', ownerId)
  if (!stores?.length) return []
  const storeName = new Map(stores.map((s: { id: string; name: string | null }) => [s.id, s.name]))
  const rows = await fetchAll<any>((a, b) => db.from('reserve_appointments')
    .select('id, appointment_no, store_id, customer_name, customer_phone, customer_email, customer_notes, start_time, status, total_price, payment_status, reserve_services(name)')
    .in('store_id', stores.map((s: { id: string }) => s.id))
    .order('start_time', { ascending: true })
    .range(a, b))
  return rows.map(r => ({
    source: 'reserve',
    source_id: r.id,
    kind: 'appointment',
    title: `預約 ${r.reserve_services?.name ?? '服務'}${storeName.get(r.store_id) ? `（${storeName.get(r.store_id)}）` : ''}`,
    amount: Number(r.total_price) || 0,
    status: r.status,
    occurred_at: r.start_time,
    meta: { appointment_no: r.appointment_no, payment_status: r.payment_status, notes: r.customer_notes ?? null },
    name: r.customer_name,
    idents: baseIdents(r.customer_phone, r.customer_email),
  }))
}

async function loadBooking(db: SupabaseClient, ownerId: string): Promise<SourceRecord[]> {
  const rows = await fetchAll<any>((a, b) => db.from('bookings')
    .select('id, order_id, property_id, platform, platform_booking_id, guest_name, guest_email, guest_phone, check_in, check_out, num_guests, total_price, status, properties(name)')
    .eq('user_id', ownerId)
    .order('check_in', { ascending: true })
    .range(a, b))
  // 一張訂單多個房型 → 合併成一筆紀錄
  const groups = new Map<string, any[]>()
  for (const r of rows) {
    const key = r.order_id ?? r.id
    const g = groups.get(key)
    if (g) g.push(r)
    else groups.set(key, [r])
  }
  return [...groups.entries()].map(([key, g]) => {
    const r = g[0]
    const rooms = [...new Set(g.map(x => x.properties?.name).filter(Boolean))]
    const active = g.filter(x => !EXCLUDED_STATUS.has(x.status))
    return {
      source: 'booking',
      source_id: key,
      kind: 'stay',
      title: `住宿 ${r.check_in} → ${r.check_out}${rooms.length ? `（${rooms.join('、')}）` : ''}`,
      amount: (active.length ? active : g).reduce((s, x) => s + (Number(x.total_price) || 0), 0),
      status: active.length ? active[0].status : r.status,
      occurred_at: `${r.check_in}T00:00:00+08:00`,
      meta: { platform: r.platform, platform_booking_id: r.platform_booking_id, nights_from: r.check_in, nights_to: r.check_out, guests: r.num_guests, rooms },
      name: g.find(x => x.guest_name)?.guest_name ?? null,
      idents: baseIdents(g.find(x => x.guest_phone)?.guest_phone, g.find(x => x.guest_email)?.guest_email),
    } as SourceRecord
  })
}

async function loadEsim(db: SupabaseClient): Promise<SourceRecord[]> {
  const rows = await fetchAll<any>((a, b) => db.from('esim_orders')
    .select('id, order_no, customer_email, customer_name, customer_phone, channel_dataplan_name, country_name, day, data_amount, quantity, total_price_twd, payment_status, paid_at, created_at')
    .order('created_at', { ascending: true })
    .range(a, b))
  return rows.map(r => {
    const paid = !!r.paid_at || r.payment_status === 'paid'
    return {
      source: 'esim',
      source_id: r.id,
      kind: 'purchase',
      title: `eSIM ${r.country_name} ${r.day}天 ${r.data_amount}${r.quantity > 1 ? ` ×${r.quantity}` : ''}`,
      amount: Number(r.total_price_twd) || 0,
      status: paid ? 'paid' : r.payment_status,
      occurred_at: r.paid_at ?? r.created_at,
      meta: { order_no: r.order_no, plan: r.channel_dataplan_name },
      name: r.customer_name,
      idents: baseIdents(r.customer_phone, r.customer_email),
    } as SourceRecord
  })
}

async function loadCs(db: SupabaseClient, ownerId: string): Promise<SourceRecord[]> {
  const rows = await fetchAll<any>((a, b) => db.from('cs_customers')
    .select('id, platform, from_id, industry, name, stage, message_count, summary, facts, first_seen_at, last_message_at')
    .eq('user_id', ownerId)
    .order('first_seen_at', { ascending: true })
    .range(a, b))
  const out: SourceRecord[] = []
  for (const r of rows) {
    const kind = csPlatformToKind(r.platform)
    if (!kind) continue
    const idents: Ident[] = []
    const value = kind === 'whatsapp' ? normalizePhone(r.from_id) : String(r.from_id)
    if (value) idents.push({ kind, value, label: r.name, cs_customer_id: r.id })
    const facts = (r.facts ?? {}) as Record<string, unknown>
    idents.push(...baseIdents(facts.phone ?? facts.guest_phone ?? (kind === 'whatsapp' ? r.from_id : null), facts.email ?? facts.guest_email))
    out.push({
      source: 'cs',
      source_id: r.id,
      kind: 'conversation',
      title: `客服對話（${r.platform}）· ${r.message_count ?? 0} 則訊息`,
      amount: null,
      status: r.stage,
      occurred_at: r.last_message_at ?? r.first_seen_at,
      meta: { platform: r.platform, industry: r.industry, first_seen_at: r.first_seen_at, facts },
      name: (facts.guest_name as string) ?? r.name,
      idents,
      summary: r.summary,
    })
  }
  return out
}

export interface CrmSyncResult {
  records: number
  contactsCreated: number
  activities: number
  sources: Record<string, number>
}

/** 同步單一擁有者的所有客人資料。includeEsim：eSIM 商店為平台自營，只同步給管理員。 */
export async function syncCrmForOwner(ownerId: string, opts: { includeEsim?: boolean } = {}): Promise<CrmSyncResult> {
  const db = createAdminClient() as SupabaseClient
  const [reserve, booking, esim, cs] = await Promise.all([
    loadReserve(db, ownerId),
    loadBooking(db, ownerId),
    opts.includeEsim ? loadEsim(db) : Promise.resolve([]),
    loadCs(db, ownerId),
  ])
  const records = [...reserve, ...booking, ...esim, ...cs]

  const existing = await fetchAll<{ contact_id: string; kind: string; value: string }>((a, b) => db.from('crm_identities')
    .select('contact_id, kind, value').eq('owner_id', ownerId).order('id').range(a, b))
  const identMap = new Map(existing.map(i => [`${i.kind}:${i.value}`, i.contact_id]))

  const newContacts: Record<string, unknown>[] = []
  const newIdents = new Map<string, Record<string, unknown>>()
  const activities: Record<string, unknown>[] = []
  const csSummary = new Map<string, string>()

  for (const rec of records) {
    let contactId: string | undefined
    for (const i of rec.idents) {
      contactId = identMap.get(`${i.kind}:${i.value}`)
      if (contactId) break
    }
    if (!contactId) {
      if (!rec.idents.length) continue // 沒有任何可識別資料，無法建立客人
      contactId = randomUUID()
      newContacts.push({ id: contactId, owner_id: ownerId, display_name: rec.name })
    }
    for (const i of rec.idents) {
      const key = `${i.kind}:${i.value}`
      if (identMap.has(key)) continue
      identMap.set(key, contactId)
      newIdents.set(key, { owner_id: ownerId, contact_id: contactId, kind: i.kind, value: i.value, label: i.label ?? null, cs_customer_id: i.cs_customer_id ?? null })
    }
    if (rec.summary) csSummary.set(contactId, rec.summary)
    activities.push({
      owner_id: ownerId, contact_id: contactId, source: rec.source, source_id: rec.source_id,
      kind: rec.kind, title: rec.title, amount: rec.amount, currency: rec.currency ?? 'TWD',
      status: rec.status, occurred_at: rec.occurred_at, meta: rec.meta, updated_at: new Date().toISOString(),
    })
  }

  for (let i = 0; i < newContacts.length; i += 500) {
    const { error } = await db.from('crm_contacts').insert(newContacts.slice(i, i + 500))
    if (error) throw error
  }
  const identRows = [...newIdents.values()]
  for (let i = 0; i < identRows.length; i += 500) {
    const { error } = await db.from('crm_identities').upsert(identRows.slice(i, i + 500), { onConflict: 'owner_id,kind,value', ignoreDuplicates: true })
    if (error) throw error
  }
  for (let i = 0; i < activities.length; i += 150) {
    // 已存在的紀錄只更新內容，不改 contact_id（使用者可能已手動合併過）
    const chunk = activities.slice(i, i + 150)
    const keys = chunk.map(a => a.source_id as string)
    const { data: prev } = await db.from('crm_activities').select('source, source_id, contact_id')
      .eq('owner_id', ownerId).in('source_id', keys)
    const prevMap = new Map((prev ?? []).map((p: any) => [`${p.source}:${p.source_id}`, p.contact_id]))
    for (const a of chunk) {
      const kept = prevMap.get(`${a.source}:${a.source_id}`)
      if (kept) a.contact_id = kept
    }
    const { error } = await db.from('crm_activities').upsert(chunk, { onConflict: 'owner_id,source,source_id' })
    if (error) throw error
  }

  await recomputeContacts(db, ownerId, csSummary)

  return {
    records: records.length,
    contactsCreated: newContacts.length,
    activities: activities.length,
    sources: { reserve: reserve.length, booking: booking.length, esim: esim.length, cs: cs.length },
  }
}

/** 重新計算每位客人的累計消費、次數、首次 / 最近互動時間，並補齊空白的姓名、電話、Email */
export async function recomputeContacts(db: SupabaseClient, ownerId: string, csSummary = new Map<string, string>(), onlyIds?: string[]) {
  const contacts = await fetchAll<any>((a, b) => {
    let q = db.from('crm_contacts').select('id, display_name, phone, email, ai_summary').eq('owner_id', ownerId)
    if (onlyIds) q = q.in('id', onlyIds)
    return q.order('id').range(a, b)
  })
  if (!contacts.length) return
  const ids = new Set(contacts.map(c => c.id))

  const acts = await fetchAll<any>((a, b) => {
    let q = db.from('crm_activities').select('contact_id, source, kind, amount, status, occurred_at').eq('owner_id', ownerId)
    if (onlyIds) q = q.in('contact_id', onlyIds)
    return q.order('id').range(a, b)
  })
  const idents = await fetchAll<any>((a, b) => {
    let q = db.from('crm_identities').select('contact_id, kind, value, label').eq('owner_id', ownerId)
    if (onlyIds) q = q.in('contact_id', onlyIds)
    return q.order('id').range(a, b)
  })

  const agg = new Map<string, { count: number; spent: number; first: string | null; last: string | null }>()
  for (const a of acts) {
    if (!ids.has(a.contact_id)) continue
    const g = agg.get(a.contact_id) ?? { count: 0, spent: 0, first: null, last: null }
    if (a.kind !== 'conversation' && a.kind !== 'note' && !EXCLUDED_STATUS.has(a.status)) {
      g.count++
      g.spent += Number(a.amount) || 0
    }
    if (!g.first || a.occurred_at < g.first) g.first = a.occurred_at
    if (!g.last || a.occurred_at > g.last) g.last = a.occurred_at
    agg.set(a.contact_id, g)
  }
  const identBy = new Map<string, any[]>()
  for (const i of idents) {
    const l = identBy.get(i.contact_id)
    if (l) l.push(i)
    else identBy.set(i.contact_id, [i])
  }

  const now = new Date().toISOString()
  const updates = contacts.map(c => {
    const g = agg.get(c.id) ?? { count: 0, spent: 0, first: null, last: null }
    const list = identBy.get(c.id) ?? []
    const patch: Record<string, unknown> = {
      order_count: g.count,
      total_spent: Math.round(g.spent * 100) / 100,
      first_seen_at: g.first,
      last_activity_at: g.last,
      updated_at: now,
    }
    if (!c.phone) patch.phone = list.find(i => i.kind === 'phone')?.value ?? null
    if (!c.email) patch.email = list.find(i => i.kind === 'email')?.value ?? null
    if (!c.display_name) patch.display_name = list.find(i => i.label)?.label ?? null
    const s = csSummary.get(c.id)
    if (s && s !== c.ai_summary) patch.ai_summary = s
    return { id: c.id, patch }
  })
  for (let i = 0; i < updates.length; i += 25) {
    await Promise.all(updates.slice(i, i + 25).map(u => db.from('crm_contacts').update(u.patch).eq('id', u.id)))
  }
}
