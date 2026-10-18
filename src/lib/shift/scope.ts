// 排班／門市評分的存取：門市單位或門市領班。
// 門市領班必須綁定門市（未綁定視為無權限），門市單位未綁定門市則不限。
import { getUnitContextAny, storeAllowed, type UnitContext } from '@/lib/auth/unit-access'

export async function getShiftContext(): Promise<UnitContext> {
  const ctx = await getUnitContextAny(['store', 'store_leader'])
  if (!ctx.ok || ctx.isAdmin) return ctx
  const units = ctx.units ?? []
  if (!units.includes('store') && !ctx.storeCodes) return { ...ctx, ok: false, status: 403 }
  return ctx
}

export { storeAllowed }

// 排班期所屬門市是否在帳號範圍內（不存在也回 false）
export async function periodAllowed(ctx: UnitContext, periodId: string): Promise<boolean> {
  if (!ctx.storeCodes) return true
  const { data } = await ctx.admin.from('shift_periods').select('store').eq('id', periodId).eq('owner_id', ctx.ownerId).maybeSingle()
  return !!data && storeAllowed(ctx, data.store as string)
}
