import { NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { companyAccounts } from '@/lib/hr/account-sync'

// 可綁定的系統帳號：本公司帳號與目前綁定的員工
export async function GET() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const accounts = await companyAccounts(ctx.admin, ctx.ownerId)
  const { data: linked } = await ctx.admin.from('hr_employees').select('id, name, profile_id')
    .eq('owner_id', ctx.ownerId).not('profile_id', 'is', null)
  const byProfile = new Map((linked ?? []).map(e => [e.profile_id as string, { id: e.id, name: e.name }]))
  return NextResponse.json({
    accounts: accounts.map(a => ({ ...a, employee: byProfile.get(a.id) ?? null })),
  })
}
