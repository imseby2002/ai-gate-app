/**
 * 多分店：一個帳號可有多間門市。後台目前操作的門市記在 cookie `reserve_store_id`，
 * 所有預約後台 API 以此取得門市（驗證屬於該使用者）；沒有或無效時用最早建立的門市。
 */
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const STORE_COOKIE = 'reserve_store_id'
export const MAX_STORES = 20

type Admin = ReturnType<typeof createAdminClient>

function cookieStoreId(req?: NextRequest | Request | null): string | null {
  if (!req) return null
  const raw = req.headers.get('cookie') ?? ''
  const m = raw.match(new RegExp(`(?:^|;\\s*)${STORE_COOKIE}=([0-9a-f-]{36})`))
  return m?.[1] ?? null
}

/** 取得使用者目前操作的門市（只取指定欄位），沒有門市回 null */
export async function getCurrentStore<T = Record<string, unknown>>(
  userId: string, req?: NextRequest | Request | null, columns = '*', admin: Admin = createAdminClient(),
): Promise<(T & { id: string }) | null> {
  const wanted = cookieStoreId(req)
  if (wanted) {
    const { data } = await admin.from('reserve_stores').select(columns).eq('id', wanted).eq('user_id', userId).maybeSingle()
    if (data) return data as unknown as T & { id: string }
  }
  const { data } = await admin.from('reserve_stores').select(columns).eq('user_id', userId)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  return (data as unknown as (T & { id: string }) | null) ?? null
}

/** 同 getCurrentStore，但沒有門市時自動建立一間預設門市 */
export async function ensureCurrentStore(userId: string, req?: NextRequest | Request | null, admin: Admin = createAdminClient()) {
  const store = await getCurrentStore<{ id: string }>(userId, req, 'id', admin)
  if (store) return store
  const { data } = await admin.from('reserve_stores').insert({
    user_id: userId, name: '我的預約門市', slug: `store-${userId.slice(0, 8)}`, category: 'beauty',
  }).select('id').single()
  return data as { id: string } | null
}

/** 使用者的所有門市 */
export async function listStores(userId: string, admin: Admin = createAdminClient()) {
  const { data } = await admin.from('reserve_stores').select('id, name, slug, is_active, created_at')
    .eq('user_id', userId).order('created_at', { ascending: true })
  return (data ?? []) as { id: string; name: string; slug: string; is_active: boolean; created_at: string }[]
}
