/**
 * PATCH  /api/company/channels/[id] — 修改名稱、使用模組、憑證（空白欄位保留原值）
 * DELETE /api/company/channels/[id] — 刪除官方帳號
 */
import { NextRequest, NextResponse } from 'next/server'
import { getChannelAccess, canEditAccount, mergeModules, type ChannelAccess } from '@/lib/channels/access'
import { mergeCredentials, isConnected, parseModules, parseName, type ChannelAccountRow } from '../shared'

export const dynamic = 'force-dynamic'

async function loadEditable(access: ChannelAccess, id: string) {
  const { data } = await access.admin
    .from('channel_accounts')
    .select('id, platform, name, credentials, modules, is_connected, updated_at')
    .eq('id', id)
    .eq('company_id', access.companyId)
    .maybeSingle()
  const row = data as ChannelAccountRow | null
  if (!row) return { error: NextResponse.json({ error: 'not_found' }, { status: 404 }) }
  if (!canEditAccount(access, row.modules)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { row }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getChannelAccess()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: access.status })
  const { id } = await params
  const { row, error } = await loadEditable(access, id)
  if (error) return error

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body && 'name' in body) {
    const name = parseName(body.name)
    if (!name) return NextResponse.json({ error: 'invalid' }, { status: 400 })
    patch.name = name
  }
  if (body && 'modules' in body) {
    const modules = mergeModules(access, row.modules, parseModules(body.modules))
    if (!access.isCompanyAdmin && !canEditAccount(access, modules)) {
      return NextResponse.json({ error: 'module_required' }, { status: 400 })
    }
    patch.modules = modules
  }
  if (body && 'credentials' in body) {
    const credentials = mergeCredentials(row.platform, row.credentials ?? {}, body.credentials)
    patch.credentials = credentials
    patch.is_connected = isConnected(row.platform, credentials)
  }

  const { error: upErr } = await access.admin.from('channel_accounts').update(patch).eq('id', id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getChannelAccess()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: access.status })
  const { id } = await params
  const { error } = await loadEditable(access, id)
  if (error) return error

  const { error: delErr } = await access.admin.from('channel_accounts').delete().eq('id', id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
