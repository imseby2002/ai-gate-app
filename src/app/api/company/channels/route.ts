/**
 * GET  /api/company/channels — 列出公司的官方帳號（可編輯者才看得到遮罩後的憑證）
 * POST /api/company/channels — 新增官方帳號（公司負責人／IT／模組負責人）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getChannelAccess, canEditAccount, mergeModules } from '@/lib/channels/access'
import { CHANNEL_PLATFORM_MAP } from '@/lib/channels/platforms'
import { maskCredentials, mergeCredentials, isConnected, parseModules, parseName, type ChannelAccountRow } from './shared'

export const dynamic = 'force-dynamic'

export async function GET() {
  const access = await getChannelAccess()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: access.status })

  const { data, error } = await access.admin
    .from('channel_accounts')
    .select('id, platform, name, credentials, modules, is_connected, updated_at')
    .eq('company_id', access.companyId)
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const accounts = ((data ?? []) as ChannelAccountRow[]).map(r => {
    const editable = canEditAccount(access, r.modules)
    return {
      id: r.id,
      platform: r.platform,
      name: r.name,
      modules: r.modules,
      is_connected: r.is_connected,
      updated_at: r.updated_at,
      editable,
      preview: editable ? maskCredentials(r.platform, r.credentials) : {},
    }
  })

  return NextResponse.json({
    accounts,
    isCompanyAdmin: access.isCompanyAdmin,
    managedModules: access.managedModules,
  })
}

export async function POST(req: NextRequest) {
  const access = await getChannelAccess()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: access.status })
  if (!access.managedModules.length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const platform = typeof body?.platform === 'string' ? body.platform : ''
  const name = parseName(body?.name)
  if (!CHANNEL_PLATFORM_MAP[platform] || !name) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const modules = mergeModules(access, [], parseModules(body?.modules))
  // 模組負責人新增的帳號至少要掛上自己負責的一個模組，否則建立後自己就無法再管理
  if (!access.isCompanyAdmin && !modules.length) return NextResponse.json({ error: 'module_required' }, { status: 400 })

  const credentials = mergeCredentials(platform, {}, body?.credentials)
  const { data, error } = await access.admin.from('channel_accounts').insert({
    company_id: access.companyId,
    platform,
    name,
    modules,
    credentials,
    is_connected: isConnected(platform, credentials),
    created_by: access.userId,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id })
}
