import type { SupabaseClient } from '@supabase/supabase-js'
import { computeStayPrice } from './pricing'

// Google Hotel Center「Free Booking Links」用的 feed 輔助。
// 把整間民宿(bnb_profile)視為一間 Google「飯店」，slug 作為 hotel id；
// 房價取「該日期區間仍可訂的房型中最低價」(顯示「最低 $X 起」)，
// 旅客點擊後導回 /book/[slug]/booking 選房型完成訂房。

export function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!))
}

export interface FeedProfile {
  user_id: string
  name: string
  address?: string | null
  city?: string | null
  phone?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  google_feed_enabled?: boolean | null
}

export async function loadFeedProfile(
  admin: SupabaseClient, slug: string,
): Promise<FeedProfile | null> {
  const { data } = await admin
    .from('bnb_profiles')
    .select('user_id, name, address, city, phone, country, latitude, longitude, google_feed_enabled')
    .eq('slug', slug).maybeSingle()
  return data ?? null
}

function enumerateNights(checkIn: string, nights: number): string[] {
  const start = new Date(`${checkIn}T00:00:00Z`).getTime()
  if (isNaN(start) || nights <= 0) return []
  return Array.from({ length: nights }, (_, i) =>
    new Date(start + i * 86400000).toISOString().slice(0, 10))
}

interface PropRow { id: string; max_guests: number | null }

// 回傳該入住日期+晚數下「最低可訂房型價格」；無任何房型可訂則回 null。
export async function lowestAvailableRate(
  admin: SupabaseClient, userId: string, checkIn: string, nights: number,
): Promise<{ total: number; currency: string } | null> {
  if (nights <= 0) return null
  const checkOut = new Date(new Date(`${checkIn}T00:00:00Z`).getTime() + nights * 86400000)
    .toISOString().slice(0, 10)
  const wantNights = new Set(enumerateNights(checkIn, nights))

  const { data: props } = await admin
    .from('properties').select('id, max_guests')
    .eq('user_id', userId).eq('status', 'active')
  if (!props?.length) return null

  // 一次撈出區間內所有占用(訂單/公開訂單/封鎖)，再依房型判斷可訂與否。
  const [{ data: bk }, { data: pub }, { data: blk }] = await Promise.all([
    admin.from('bookings').select('property_id, check_in, check_out')
      .eq('user_id', userId).in('status', ['pending', 'confirmed'])
      .lt('check_in', checkOut).gt('check_out', checkIn),
    admin.from('public_bookings').select('property_id, check_in, check_out')
      .eq('host_user_id', userId).in('status', ['pending', 'confirmed'])
      .lt('check_in', checkOut).gt('check_out', checkIn),
    admin.from('blocked_dates').select('property_id, date')
      .eq('user_id', userId).gte('date', checkIn).lt('date', checkOut),
  ])

  const occupied = new Map<string, Set<string>>() // property_id ->占用日期
  const mark = (pid: string, d: string) => {
    if (!occupied.has(pid)) occupied.set(pid, new Set())
    occupied.get(pid)!.add(d)
  }
  const markRange = (pid: string, ci: string, co: string) => {
    const n = Math.round((new Date(`${co}T00:00:00Z`).getTime() - new Date(`${ci}T00:00:00Z`).getTime()) / 86400000)
    for (const d of enumerateNights(ci, n)) mark(pid, d)
  }
  for (const b of bk ?? []) markRange(b.property_id, b.check_in, b.check_out)
  for (const b of pub ?? []) markRange(b.property_id, b.check_in, b.check_out)
  for (const b of blk ?? []) mark(b.property_id, b.date)

  let best: { total: number; currency: string } | null = null
  for (const p of (props as PropRow[])) {
    const occ = occupied.get(p.id)
    if (occ && [...wantNights].some(d => occ.has(d))) continue // 區間內有占用 → 不可訂
    const quote = await computeStayPrice(admin, userId, p.id, checkIn, checkOut, 1)
    if (!quote || quote.warnings.length) continue // 無定價/超人數 → 略過
    if (!best || quote.total < best.total) best = { total: quote.total, currency: quote.currency }
  }
  return best
}
