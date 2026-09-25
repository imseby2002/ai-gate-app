import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { StorageService } from '@/lib/social-matrix/storage'
import { ProxyType, ProxyProtocol } from '@/lib/social-matrix/types'

export async function GET(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const authUser = guard.user

  try {
    const supabase = await createClient()

    // 1. Fetch official proxies from DB
    const { data: dbOfficial, error: offErr } = await supabase
      .from('marketing_official_proxies')
      .select('*')
      .order('created_at', { ascending: false })

    // 2. Fetch user's active leases
    const { data: dbLeases, error: leaseErr } = await supabase
      .from('marketing_proxy_leases')
      .select('*, official_proxy:marketing_official_proxies(*)')
      .eq('user_id', authUser.id)
      .eq('status', 'active')

    if (offErr || !dbOfficial || dbOfficial.length === 0) {
      // Use fallback
      return NextResponse.json({
        official_proxies: StorageService.getOfficialProxies(),
        leases: StorageService.getLeases(authUser.id),
      })
    }

    return NextResponse.json({
      official_proxies: dbOfficial,
      leases: dbLeases || StorageService.getLeases(authUser.id),
    })
  } catch (err) {
    console.warn('[official-proxies GET] Fallback to StorageService:', err)
    return NextResponse.json({
      official_proxies: StorageService.getOfficialProxies(),
      leases: StorageService.getLeases(authUser.id),
    })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const authUser = guard.user

  try {
    const body = await req.json()
    const { action = 'lease' } = body

    // ==========================================
    // ACTION 1: ADMIN CREATE OFFICIAL PROXY
    // ==========================================
    if (action === 'admin_create') {
      const {
        name,
        proxy_type = 'home_static',
        protocol = 'http',
        host,
        port,
        username,
        password,
        country = 'TW',
        city,
        isp,
        latency_ms = 20,
        monthly_price_twd = 299,
        max_tenants = 1,
        notes,
      } = body

      if (!host || !port || !name) {
        return NextResponse.json({ error: '請完整提供名稱、主機位址 (Host) 與通訊埠 (Port)' }, { status: 400 })
      }

      let createdProxy: any = null

      try {
        const supabase = await createClient()
        const { data, error } = await supabase
          .from('marketing_official_proxies')
          .insert({
            name,
            proxy_type,
            protocol,
            host,
            port: Number(port),
            username,
            password,
            country,
            city,
            isp,
            latency_ms: Number(latency_ms) || 20,
            monthly_price_twd: Number(monthly_price_twd) || 299,
            max_tenants: Number(max_tenants) || 1,
            current_tenants_count: 0,
            status: 'available',
            is_active: true,
            notes,
          })
          .select()
          .single()

        if (!error && data) {
          createdProxy = data
        }
      } catch (err) {
        console.warn('[official-proxies POST admin_create] DB error:', err)
      }

      // In-memory fallback / sync
      const fallbackProxy = StorageService.addOfficialProxy({
        name,
        proxy_type: proxy_type as ProxyType,
        protocol: protocol as ProxyProtocol,
        host,
        port: Number(port),
        username,
        password,
        country,
        city,
        isp,
        latency_ms: Number(latency_ms) || 20,
        monthly_price_twd: Number(monthly_price_twd) || 299,
        max_tenants: Number(max_tenants) || 1,
        status: 'available',
        is_active: true,
        notes,
      })

      return NextResponse.json({
        success: true,
        official_proxy: createdProxy || fallbackProxy,
        message: '官方供租用 IP 已成功上架！',
      })
    }

    // ==========================================
    // ACTION 2: USER LEASE OFFICIAL PROXY
    // ==========================================
    if (action === 'lease') {
      const { official_proxy_id } = body
      if (!official_proxy_id) {
        return NextResponse.json({ error: '請指定要租用的官方 IP' }, { status: 400 })
      }

      let leasedResult: any = null

      try {
        // Execute storage lease first to validate availability and inject to proxy pool
        leasedResult = StorageService.leaseOfficialProxy(authUser.id, official_proxy_id)

        // Try syncing to DB if tables exist
        const supabase = await createClient()
        await supabase
          .from('marketing_proxy_leases')
          .insert({
            user_id: authUser.id,
            official_proxy_id,
            status: 'active',
          })
          .select()
          .single()

        // Also add to marketing_proxies so standard proxy APIs see it
        await supabase.from('marketing_proxies').insert({
          user_id: authUser.id,
          name: leasedResult.proxy.name,
          proxy_type: leasedResult.proxy.proxy_type,
          protocol: leasedResult.proxy.protocol,
          host: leasedResult.proxy.host,
          port: leasedResult.proxy.port,
          username: leasedResult.proxy.username,
          password: leasedResult.proxy.password,
          country: leasedResult.proxy.country,
          city: leasedResult.proxy.city,
          isp: leasedResult.proxy.isp,
          status: 'active',
          latency_ms: leasedResult.proxy.latency_ms,
          notes: leasedResult.proxy.notes,
        })
      } catch (err) {
        // If storage lease succeeded, we consider it a success
        if (!leasedResult) {
          return NextResponse.json({ error: String(err) }, { status: 400 })
        }
      }

      return NextResponse.json({
        success: true,
        lease: leasedResult.lease,
        proxy: leasedResult.proxy,
        message: '🎉 官方專屬原生 IP 租用成功！已自動注入您的代理池，可立即前往帳號矩陣綁定使用。',
      })
    }

    return NextResponse.json({ error: '不支援的操作類型' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: `處理失敗: ${String(err)}` }, { status: 500 })
  }
}
