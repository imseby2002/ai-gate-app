import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import type { ProxyType, ProxyProtocol } from '@/lib/social-matrix/types'

const PROXY_TYPES: ProxyType[] = ['home_static', 'residential', 'mobile_4g']
const PROTOCOLS: ProxyProtocol[] = ['http', 'https', 'socks5']

export async function GET(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res

  const supabase = await createClient()
  const [{ data: proxies, error }, { data: accounts }] = await Promise.all([
    supabase.from('marketing_proxies').select('*').order('created_at', { ascending: false }),
    supabase.from('marketing_social_accounts').select('proxy_id'),
  ])
  if (error) return NextResponse.json({ error: `讀取代理失敗：${error.message}` }, { status: 500 })

  const counts = new Map<string, number>()
  for (const a of accounts ?? []) if (a.proxy_id) counts.set(a.proxy_id, (counts.get(a.proxy_id) ?? 0) + 1)
  return NextResponse.json({
    proxies: (proxies ?? []).map(p => ({ ...p, assigned_count: counts.get(p.id) ?? 0, source: p.lease_id ? 'official_leased' : 'custom' })),
  })
}

export async function POST(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const userId = guard.user.id

  const body = await req.json().catch(() => ({}))
  const proxyType: ProxyType = PROXY_TYPES.includes(body.proxy_type) ? body.proxy_type : 'residential'
  const protocol: ProxyProtocol = PROTOCOLS.includes(body.protocol) ? body.protocol : 'http'
  const supabase = await createClient()

  // 批次匯入：每行 host:port 或 host:port:username:password（# 開頭為註解）
  if (body.batchText) {
    const rows = String(body.batchText)
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(line => {
        const [host, port, username, ...rest] = line.split(':').map(s => s.trim())
        return { host, port: parseInt(port, 10), username: username || null, password: rest.join(':') || null }
      })
      .filter(r => r.host && Number.isFinite(r.port))
      .map(r => ({
        user_id: userId,
        name: `${r.host}:${r.port}`,
        proxy_type: proxyType,
        protocol,
        host: r.host,
        port: r.port,
        username: r.username,
        password: r.password,
        country: body.country || 'TW',
        status: 'testing',
        notes: '批次匯入代理',
      }))
    if (rows.length === 0) return NextResponse.json({ error: '沒有可匯入的代理（格式 host:port 或 host:port:帳號:密碼）' }, { status: 400 })
    const { data, error } = await supabase.from('marketing_proxies').insert(rows).select()
    if (error) return NextResponse.json({ error: `匯入失敗：${error.message}` }, { status: 500 })
    return NextResponse.json({ success: true, count: data.length, proxies: data })
  }

  const { name, host, port, username, password, country = 'TW', city, isp, notes } = body
  if (!host || !port) {
    return NextResponse.json({ error: '請提供 IP/主機位址 與 通訊埠 (Port)' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('marketing_proxies')
    .insert({
      user_id: userId,
      name: name || `${host}:${port}`,
      proxy_type: proxyType,
      protocol,
      host: String(host).trim(),
      port: Number(port),
      username: username || null,
      password: password || null,
      country,
      city: city || null,
      isp: isp || null,
      status: 'testing',
      notes: notes || null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: `新增代理失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true, proxy: data })
}
