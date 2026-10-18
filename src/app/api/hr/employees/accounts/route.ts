import { NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { companyAccounts } from '@/lib/hr/account-sync'

// 可綁定的系統帳號：本公司帳號與目前綁定的員工；另附門市清單（管理門市多選用）
export async function GET() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const accounts = await companyAccounts(ctx.admin, ctx.ownerId)
  const { data: linked } = await ctx.admin.from('hr_employees').select('id, name, profile_id')
    .eq('owner_id', ctx.ownerId).not('profile_id', 'is', null)
  const { data: stores } = await ctx.admin.from('fin_stores').select('code, name, unit_type, active')
    .eq('owner_id', ctx.ownerId).order('code')
  const byProfile = new Map((linked ?? []).map(e => [e.profile_id as string, { id: e.id, name: e.name }]))
  return NextResponse.json({
    accounts: accounts.map(a => ({ ...a, employee: byProfile.get(a.id) ?? null })),
    stores: (stores ?? []).filter(r => r.code && r.active !== false && (r.unit_type ?? 'store') === 'store')
      .map(r => ({ code: String(r.code).trim(), name: String(r.name ?? '').trim() })),
  })
}
