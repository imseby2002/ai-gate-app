import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { testProxy, type ProxyTestInput } from '@/lib/social-matrix/proxy-test'

export const runtime = 'nodejs'
export const maxDuration = 30

// 實測代理：經代理連到 ipinfo.io 取得出口 IP／國家／ISP 與延遲，結果寫回代理池
export async function POST(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res

  const body = await req.json().catch(() => ({}))
  const supabase = await createClient()

  let input: ProxyTestInput
  if (body.id) {
    const { data: p } = await supabase
      .from('marketing_proxies')
      .select('protocol, host, port, username, password')
      .eq('id', body.id)
      .maybeSingle()
    if (!p) return NextResponse.json({ success: false, message: '找不到此代理' }, { status: 404 })
    input = p as ProxyTestInput
  } else {
    input = { protocol: body.protocol ?? 'http', host: body.host, port: Number(body.port), username: body.username, password: body.password }
  }

  const r = await testProxy(input)
  const testedAt = new Date().toISOString()
  if (body.id) {
    await supabase.from('marketing_proxies').update({
      status: r.ok ? 'active' : 'error',
      latency_ms: r.ok ? r.latency_ms : null,
      last_checked_at: testedAt,
      ...(r.ok && r.country ? { country: r.country } : {}),
      ...(r.ok && r.city ? { city: r.city } : {}),
      ...(r.ok && r.org ? { isp: r.org } : {}),
      updated_at: testedAt,
    }).eq('id', body.id)
  }

  if (!r.ok) {
    return NextResponse.json({ success: false, status: 'error', latency_ms: 0, tested_at: testedAt, message: `連線失敗：${r.error}` })
  }
  const where = [r.country, r.city].filter(Boolean).join(' ')
  return NextResponse.json({
    success: true,
    status: 'active',
    latency_ms: r.latency_ms,
    tested_at: testedAt,
    exit_ip: r.ip,
    country: r.country,
    city: r.city,
    isp: r.org,
    message: r.ip
      ? `連線成功！出口 IP ${r.ip}${where ? `（${where}${r.org ? `，${r.org}` : ''}）` : ''}，建立通道 ${r.latency_ms}ms`
      : `連線成功，建立通道 ${r.latency_ms}ms（${r.error}）`,
  })
}
