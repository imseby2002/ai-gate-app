import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSocialMatrix, requirePlatformAdmin, getOfficialProxyQuota } from '@/lib/social-matrix/access'
import { StorageService } from '@/lib/social-matrix/storage'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUsdToTwdRate } from '@/lib/fx'
import { isBillableUser } from '@/lib/marketing/billing'
import { deductCredits } from '@/lib/skills/billing'
import { officialProxyCredits, nextExpiry } from '@/lib/social-matrix/lease-billing'
import { ProxyType, ProxyProtocol } from '@/lib/social-matrix/types'

export async function GET(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const authUser = guard.user
  const activeInMemory = () => StorageService.getLeases(authUser.id).filter(l => l.status === 'active').length
  const { isAdmin, quota, used } = await getOfficialProxyQuota(authUser, activeInMemory())
  // usd_twd_rate：前端用來把 monthly_price_twd 換算成點數顯示（點數＝美金）
  const meta = { is_admin: isAdmin, lease_quota: quota, lease_used: used, usd_twd_rate: await getUsdToTwdRate() }

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
        ...meta,
        official_proxies: StorageService.getOfficialProxies(),
        leases: StorageService.getLeases(authUser.id),
      })
    }

    return NextResponse.json({
        ...meta,
      official_proxies: dbOfficial,
      leases: dbLeases || StorageService.getLeases(authUser.id),
    })
  } catch (err) {
    console.warn('[official-proxies GET] Fallback to StorageService:', err)
    return NextResponse.json({
        ...meta,
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
      const denied = await requirePlatformAdmin(authUser)
      if (denied) return denied
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

      const activeInMemory = StorageService.getLeases(authUser.id).filter(l => l.status === 'active').length
      const { isAdmin, quota, used } = await getOfficialProxyQuota(authUser, activeInMemory)
      if (!isAdmin && quota <= 0) {
        return NextResponse.json({ error: '目前方案未開放官方 IP，請升級至 PRO 以上或自備 IP' }, { status: 403 })
      }

      // 附贈額度內免費；超出以點數購買（每 30 天扣一次，到期自動續扣）
      const admin = createAdminClient()
      const isPaid = !isAdmin && used >= quota
      const billable = await isBillableUser(authUser.id)
      const charge = async (name: string, priceTwd: number) => {
        const price = await officialProxyCredits(priceTwd)
        if (!billable) return { ok: true as const, price }
        const r = await deductCredits(authUser.id, price, `官方發文 IP 租用 30 天：${name}`)
        return r.ok ? { ok: true as const, price } : { ok: false as const, price }
      }
      const successMessage = (price: number) => isPaid
        ? `🎉 已扣 ${price} 點租用 30 天，到期自動續扣；已注入您的代理池，可立即綁定帳號使用。`
        : '🎉 已領取方案附贈的官方 IP！已自動注入您的代理池，可立即前往帳號矩陣綁定使用。'

      // 以資料庫為準：先確認名額，再扣點，最後寫入租用、代理池與名額
      const { data: off } = await admin
        .from('marketing_official_proxies')
        .select('*')
        .eq('id', official_proxy_id)
        .maybeSingle()

      if (off) {
        if (!off.is_active || off.status === 'maintenance') {
          return NextResponse.json({ error: '該官方 IP 目前維護保養中，暫停租用' }, { status: 409 })
        }
        if ((off.current_tenants_count ?? 0) >= (off.max_tenants ?? 1)) {
          return NextResponse.json({ error: '該官方 IP 目前已被其他客戶專屬租用中，暫無空位' }, { status: 409 })
        }

        let price = 0
        if (isPaid) {
          const c = await charge(off.name, off.monthly_price_twd)
          if (!c.ok) return NextResponse.json({ error: '點數不足', required: c.price }, { status: 402 })
          price = c.price
        }

        const { data: lease, error: leaseErr } = await admin
          .from('marketing_proxy_leases')
          .insert({
            user_id: authUser.id,
            official_proxy_id,
            status: 'active',
            is_paid: isPaid,
            price_credits: isPaid ? price : null,
            expires_at: isPaid ? nextExpiry() : null,
          })
          .select()
          .single()
        if (leaseErr || !lease) {
          console.error('[official-proxies lease] insert failed after charge', { userId: authUser.id, official_proxy_id, price, leaseErr })
          return NextResponse.json({ error: '租用紀錄建立失敗，請聯繫客服' }, { status: 500 })
        }

        const { data: proxy } = await admin.from('marketing_proxies').insert({
          user_id: authUser.id,
          lease_id: lease.id,
          name: `🏢 [官方租用] ${off.name}`,
          proxy_type: off.proxy_type,
          protocol: off.protocol,
          host: off.host,
          port: off.port,
          username: off.username,
          password: off.password,
          country: off.country,
          city: off.city,
          isp: off.isp,
          status: 'active',
          latency_ms: off.latency_ms,
          notes: off.notes,
        }).select().single()

        const tenants = (off.current_tenants_count ?? 0) + 1
        await admin
          .from('marketing_official_proxies')
          .update({ current_tenants_count: tenants, status: tenants >= (off.max_tenants ?? 1) ? 'rented_out' : 'available', updated_at: new Date().toISOString() })
          .eq('id', official_proxy_id)

        return NextResponse.json({ success: true, lease, proxy, charged_credits: price, message: successMessage(price) })
      }

      // 資料庫查無此 IP → 記憶體示範資料
      let leasedResult: ReturnType<typeof StorageService.leaseOfficialProxy>
      try {
        leasedResult = StorageService.leaseOfficialProxy(authUser.id, official_proxy_id)
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 })
      }
      let price = 0
      if (isPaid) {
        const offMem = StorageService.getOfficialProxies().find(p => p.id === official_proxy_id)
        const c = await charge(offMem?.name ?? official_proxy_id, offMem?.monthly_price_twd ?? 0)
        if (!c.ok) {
          StorageService.releaseOfficialProxy(authUser.id, leasedResult.lease.id)
          return NextResponse.json({ error: '點數不足', required: c.price }, { status: 402 })
        }
        price = c.price
      }
      return NextResponse.json({
        success: true,
        lease: leasedResult.lease,
        proxy: leasedResult.proxy,
        charged_credits: price,
        message: successMessage(price),
      })
    }

    return NextResponse.json({ error: '不支援的操作類型' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: `處理失敗: ${String(err)}` }, { status: 500 })
  }
}
