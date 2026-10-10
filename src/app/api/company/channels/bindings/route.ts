/**
 * GET /api/company/channels/bindings?module=affairs
 *   → 該模組在各平台可選的官方帳號、目前選用的帳號、是否可修改
 * PUT /api/company/channels/bindings  { module, platform, account_id | null }
 *   → 設定（或清除）模組在該平台選用的帳號；僅公司負責人／IT 或該模組負責人
 *     選用的帳號若尚未勾選此模組，會一併加上
 */
import { NextRequest, NextResponse } from 'next/server'
import { getChannelAccess } from '@/lib/channels/access'
import { CHANNEL_PLATFORM_MAP, isChannelModule } from '@/lib/channels/platforms'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const access = await getChannelAccess()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: access.status })
  const mod = req.nextUrl.searchParams.get('module')
  if (!isChannelModule(mod)) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const [{ data: accounts }, { data: bindings }] = await Promise.all([
    access.admin.from('channel_accounts')
      .select('id, platform, name, modules, is_connected')
      .eq('company_id', access.companyId)
      .order('created_at'),
    access.admin.from('channel_module_bindings')
      .select('platform, account_id')
      .eq('company_id', access.companyId)
      .eq('module', mod),
  ])

  return NextResponse.json({
    accounts: accounts ?? [],
    bindings: Object.fromEntries((bindings ?? []).map(b => [b.platform, b.account_id])),
    canEdit: (access.managedModules as string[]).includes(mod),
  })
}

export async function PUT(req: NextRequest) {
  const access = await getChannelAccess()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: access.status })

  const body = await req.json().catch(() => null) as { module?: unknown; platform?: unknown; account_id?: unknown } | null
  const mod = body?.module
  const platform = typeof body?.platform === 'string' ? body.platform : ''
  if (!isChannelModule(mod) || !CHANNEL_PLATFORM_MAP[platform]) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  if (!(access.managedModules as string[]).includes(mod)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const key = { company_id: access.companyId, module: mod, platform }

  if (body?.account_id == null || body.account_id === '') {
    const { error } = await access.admin.from('channel_module_bindings').delete().match(key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const accountId = String(body.account_id)
  const { data: acct } = await access.admin.from('channel_accounts')
    .select('id, platform, modules')
    .eq('id', accountId)
    .eq('company_id', access.companyId)
    .maybeSingle()
  if (!acct || acct.platform !== platform) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (!(acct.modules as string[]).includes(mod)) {
    await access.admin.from('channel_accounts')
      .update({ modules: [...(acct.modules as string[]), mod], updated_at: new Date().toISOString() })
      .eq('id', accountId)
  }

  const { error } = await access.admin.from('channel_module_bindings').upsert({
    ...key,
    account_id: accountId,
    updated_by: access.userId,
    updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
