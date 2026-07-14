import type { SupabaseClient } from '@supabase/supabase-js'
import type { PosCategory, PosItem, PosModifierGroup } from './types'

export async function getMenuRevision(supabase: SupabaseClient, ownerId: string) {
  const { data } = await supabase
    .from('pos_menu_meta')
    .select('revision')
    .eq('owner_id', ownerId)
    .maybeSingle()
  return data?.revision ?? 1
}

export async function bumpMenuRevision(supabase: SupabaseClient, ownerId: string) {
  const { data, error } = await supabase.rpc('bump_pos_menu_revision', { p_owner: ownerId })
  if (error) throw new Error(error.message)
  return Number(data ?? 1)
}

/** 全域 + 該門市專屬分類/品項 */
export function menuScopeFilter<T extends { store_id: string | null }>(rows: T[], storeId: string) {
  return rows.filter(r => r.store_id === null || r.store_id === storeId)
}

export function parseModifiers(raw: unknown): PosModifierGroup[] {
  if (!Array.isArray(raw)) return []
  return raw as PosModifierGroup[]
}

export async function fetchMenuForStore(
  supabase: SupabaseClient,
  ownerId: string,
  storeId: string,
  sinceRevision?: number
) {
  const revision = await getMenuRevision(supabase, ownerId)
  if (sinceRevision != null && sinceRevision >= revision) {
    return { revision, changed: false, categories: [] as PosCategory[], items: [] as PosItem[] }
  }

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from('pos_categories')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('pos_items')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const scopedCats = menuScopeFilter((categories ?? []) as PosCategory[], storeId)
  const catIds = new Set(scopedCats.map(c => c.id))
  const scopedItems = menuScopeFilter((items ?? []) as PosItem[], storeId)
    .filter(i => catIds.has(i.category_id))
    .map(i => ({ ...i, modifiers: parseModifiers(i.modifiers) }))

  return {
    revision,
    changed: true,
    categories: scopedCats,
    items: scopedItems,
  }
}

export function nextOrderNo() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}${pad(d.getDate())}-${String(d.getHours()).padStart(2, '0')}${pad(d.getMinutes())}${pad(d.getSeconds())}-${String(Math.floor(Math.random() * 900) + 100)}`
}
