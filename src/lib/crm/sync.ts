// 客戶系統（CRM）同步：把 RESERVE 預約、BOOKING 訂房、eSIM 訂單、AI 客服對話的客人
// 彙整進 crm_contacts / crm_identities / crm_activities。
//
// 範圍：以公司為單位（owner_id = 公司 owner 帳號），公司所有成員帳號的資料都匯進同一份；
// owner_id = null 為平台範圍（eSIM 商店客人）。added_by / handled_by 記錄是哪個帳號帶進來、服務的。
//
// 比對規則：同一範圍底下，電話（正規化）、Email（小寫）、平台帳號（LINE/WhatsApp…）
// 任一相同即視為同一位客人。已屬於另一位客人的身分不會被自動搶走（避免誤合併），
// 需要合併時由使用者在客戶頁手動「合併」。
// 資料列來自未產生型別的 Supabase 查詢（跨多張既有資料表），此檔以 any 讀取欄位。
/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { ownerFilter } from './scope'
import { mergeContacts } from './merge'
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
  handled_by?: string | null
}

// 訂房匯入時的佔位姓名（例如「(待補充)」）或純數字，不足以代表一位客人
const PLACEHOLDER_NAME_RE = /待補|未知|unknown|^guest$|^旅客$|^n\/?a$/i
function isUsableName(name: string | null): boolean {
  const n = (name ?? '').trim()
  return !!n && /[A-Za-z\u00c0-\u024f\u1e00-\u1eff\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(n) && !PLACEHOLDER_NAME_RE.test(n)
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
    .select('id, appointment_no, store_id, customer_name, customer_phone, customer_email, customer_notes, start_time, created_at, status, total_price, payment_status, reserve_services(name)')
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
    // 互動時間＝客人預約的時間（不是服務日期，避免未來的預約變成「最近互動」）
    occurred_at: r.created_at ?? r.start_time,
    meta: { appointment_no: r.appointment_no, payment_status: r.payment_status, notes: r.customer_notes ?? null },
    name: r.customer_name,
    idents: baseIdents(r.customer_phone, r.customer_email),
  }))
}

async function loadBooking(db: SupabaseClient, ownerId: string): Promise<SourceRecord[]> {
  const rows = await fetchAll<any>((a, b) => db.from('bookings')
    .select('id, order_id, property_id, platform, platform_booking_id, guest_name, guest_email, guest_phone, check_in, check_out, num_guests, total_price, status, created_at, properties(name)')
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
      // 互動時間＝訂房建立時間（入住日期在標題裡），避免未來的入住日變成「最近互動」
      occurred_at: g.map(x => x.created_at).filter(Boolean).sort()[0] ?? `${r.check_in}T00:00:00+08:00`,
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

// 客人在對話中自己打出的手機／Email（客服系統不一定有存進 facts）
const MSG_PHONE_RE = /(?:\+?886[\s-]?|0)9\d{2}[\s-]?\d{3}[\s-]?\d{3}/g
const MSG_EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
// 同一支電話／Email 出現在超過這麼多位客人的訊息裡，多半是店家自己的聯絡方式，不當成客人身分
const SHARED_CONTACT_LIMIT = 3

async function loadMessageIdents(db: SupabaseClient, account: string): Promise<Map<string, Ident[]>> {
  const msgs = await fetchAll<any>((a, b) => db.from('cs_messages')
    .select('platform, from_id, message')
    .eq('user_id', account)
    .filter('message', 'match', '9[0-9]{2}[- ]?[0-9]{3}[- ]?[0-9]{3}|@')
    .order('id').range(a, b))
  const byCustomer = new Map<string, Map<string, Ident>>()
  const owners = new Map<string, Set<string>>()
  for (const m of msgs) {
    const key = `${m.platform}:${m.from_id}`
    const text = String(m.message ?? '')
    const found: Ident[] = []
    for (const raw of text.match(MSG_PHONE_RE) ?? []) {
      const v = normalizePhone(raw)
      if (v) found.push({ kind: 'phone', value: v })
    }
    for (const raw of text.match(MSG_EMAIL_RE) ?? []) {
      const v = normalizeEmail(raw)
      if (v) found.push({ kind: 'email', value: v })
    }
    for (const i of found) {
      const ik = `${i.kind}:${i.value}`
      if (!byCustomer.has(key)) byCustomer.set(key, new Map())
      byCustomer.get(key)!.set(ik, i)
      if (!owners.has(ik)) owners.set(ik, new Set())
      owners.get(ik)!.add(key)
    }
  }
  const out = new Map<string, Ident[]>()
  for (const [key, ids] of byCustomer) {
    out.set(key, [...ids.entries()].filter(([ik]) => (owners.get(ik)?.size ?? 0) <= SHARED_CONTACT_LIMIT).map(([, i]) => i))
  }
  return out
}

async function loadCs(db: SupabaseClient, ownerId: string): Promise<SourceRecord[]> {
  const msgIdents = await loadMessageIdents(db, ownerId)
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
    for (const i of msgIdents.get(`${r.platform}:${r.from_id}`) ?? []) {
      if (!idents.some(x => x.kind === i.kind && x.value === i.value)) idents.push(i)
    }
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
  contactsMerged: number
  activities: number
  sources: Record<string, number>
}

/**
 * 同步一個範圍的所有客人資料。
 * ownerId：公司 owner 帳號；null = 平台範圍。accounts：要匯入哪些帳號的 RESERVE / BOOKING / 客服資料。
 * includeEsim：eSIM 商店為平台自營，只匯進平台範圍。
 */
export { companyAccounts, scopeOwnerOf } from './scope'

export async function syncCrmForScope(ownerId: string | null, accounts: string[], opts: { includeEsim?: boolean } = {}): Promise<CrmSyncResult> {
  const db = createAdminClient() as SupabaseClient
  const own = ownerFilter(ownerId)
  const tag = (account: string) => (rs: SourceRecord[]) => rs.map(r => ({ ...r, handled_by: account }))
  const perAccount = await Promise.all(accounts.map(acc => Promise.all([
    loadReserve(db, acc).then(tag(acc)),
    loadBooking(db, acc).then(tag(acc)),
    loadCs(db, acc).then(tag(acc)),
  ])))
  const reserve = perAccount.flatMap(a => a[0])
  const booking = perAccount.flatMap(a => a[1])
  const cs = perAccount.flatMap(a => a[2])
  const esim = opts.includeEsim ? await loadEsim(db) : []
  const records = [...reserve, ...booking, ...esim, ...cs]

  const existing = await fetchAll<{ contact_id: string; kind: string; value: string }>((a, b) => db.from('crm_identities')
    .select('contact_id, kind, value').filter('owner_id', ...own).order('id').range(a, b))
  const identMap = new Map(existing.map(i => [`${i.kind}:${i.value}`, i.contact_id]))
  // 已匯入過的紀錄沿用原本的客人（使用者可能已手動合併過；只靠姓名建立的客人也靠這個對回去）
  const prevActs = await fetchAll<{ source: string; source_id: string; contact_id: string }>((a, b) => db.from('crm_activities')
    .select('source, source_id, contact_id').filter('owner_id', ...own).neq('source', 'manual').order('id').range(a, b))
  const actMap = new Map(prevActs.map(a => [`${a.source}:${a.source_id}`, a.contact_id]))

  const newContacts: Record<string, unknown>[] = []
  const newIdents = new Map<string, Record<string, unknown>>()
  const activities: Record<string, unknown>[] = []
  const csSummary = new Map<string, string>()
  const mergePairs: [string, string][] = []

  for (const rec of records) {
    let contactId = actMap.get(`${rec.source}:${rec.source_id}`)
    for (const i of rec.idents) {
      if (contactId) break
      contactId = identMap.get(`${i.kind}:${i.value}`)
    }
    if (!contactId) {
      // 沒有電話／Email／平台帳號時，有姓名就單獨建一位客人（不依姓名自動合併，避免同名不同人被併在一起）
      if (!rec.idents.length && !isUsableName(rec.name)) continue
      contactId = randomUUID()
      newContacts.push({ id: contactId, owner_id: ownerId, added_by: rec.handled_by ?? null, display_name: rec.name })
    }
    for (const i of rec.idents) {
      const key = `${i.kind}:${i.value}`
      const holder = identMap.get(key)
      // 同一支電話／Email／平台帳號已屬於另一位客人 → 是同一個人，之後自動合併
      if (holder && holder !== contactId) mergePairs.push([holder, contactId])
      if (identMap.has(key)) continue
      identMap.set(key, contactId)
      newIdents.set(key, { owner_id: ownerId, contact_id: contactId, kind: i.kind, value: i.value, label: i.label ?? null, cs_customer_id: i.cs_customer_id ?? null, added_by: rec.handled_by ?? null })
    }
    if (rec.summary) csSummary.set(contactId, rec.summary)
    activities.push({
      owner_id: ownerId, contact_id: contactId, source: rec.source, source_id: rec.source_id,
      kind: rec.kind, title: rec.title, amount: rec.amount, currency: rec.currency ?? 'TWD',
      status: rec.status, occurred_at: rec.occurred_at, meta: rec.meta, handled_by: rec.handled_by ?? null, updated_at: new Date().toISOString(),
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
    const chunk = activities.slice(i, i + 150)
    const { error } = await db.from('crm_activities').upsert(chunk, { onConflict: 'owner_id,source,source_id' })
    if (error) throw error
  }

  // 自動合併：同一組身分對到多位客人時，併到最早建立的那位（union-find 處理連鎖）
  const parent = new Map<string, string>()
  const find = (x: string): string => { const p = parent.get(x); if (!p || p === x) return x; const r = find(p); parent.set(x, r); return r }
  for (const [keep, drop] of mergePairs) {
    const a = find(keep), b = find(drop)
    if (a !== b) parent.set(b, a)
  }
  let merged = 0
  for (const id of parent.keys()) {
    const root = find(id)
    if (root !== id) {
      await mergeContacts(db, ownerId, root, id)
      merged++
    }
  }

  await recomputeContacts(db, ownerId, csSummary)

  return {
    records: records.length,
    contactsCreated: newContacts.length,
    contactsMerged: merged,
    activities: activities.length,
    sources: { reserve: reserve.length, booking: booking.length, esim: esim.length, cs: cs.length },
  }
}

/** 重新計算每位客人的累計消費、次數、首次 / 最近互動時間，並補齊空白的姓名、電話、Email */
export async function recomputeContacts(db: SupabaseClient, ownerId: string | null, csSummary = new Map<string, string>(), onlyIds?: string[]) {
  const contacts = await fetchAll<any>((a, b) => {
    let q = db.from('crm_contacts').select('id, display_name, phone, email, ai_summary').filter('owner_id', ...ownerFilter(ownerId))
    if (onlyIds) q = q.in('id', onlyIds)
    return q.order('id').range(a, b)
  })
  if (!contacts.length) return
  const ids = new Set(contacts.map(c => c.id))

  const acts = await fetchAll<any>((a, b) => {
    let q = db.from('crm_activities').select('contact_id, source, kind, amount, status, occurred_at').filter('owner_id', ...ownerFilter(ownerId))
    if (onlyIds) q = q.in('contact_id', onlyIds)
    return q.order('id').range(a, b)
  })
  const idents = await fetchAll<any>((a, b) => {
    let q = db.from('crm_identities').select('contact_id, kind, value, label').filter('owner_id', ...ownerFilter(ownerId))
    if (onlyIds) q = q.in('contact_id', onlyIds)
    return q.order('id').range(a, b)
  })

  const nowIso = new Date().toISOString()
  const agg = new Map<string, { count: number; spent: number; first: string | null; last: string | null }>()
  for (const a of acts) {
    if (!ids.has(a.contact_id)) continue
    const g = agg.get(a.contact_id) ?? { count: 0, spent: 0, first: null, last: null }
    if (a.kind !== 'conversation' && a.kind !== 'note' && !EXCLUDED_STATUS.has(a.status)) {
      g.count++
      g.spent += Number(a.amount) || 0
    }
    if (!g.first || a.occurred_at < g.first) g.first = a.occurred_at
    if (a.occurred_at <= nowIso && (!g.last || a.occurred_at > g.last)) g.last = a.occurred_at
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
