import { NextRequest, NextResponse } from 'next/server'
import { requireSocialMatrix, requirePlatformAdmin, isPlatformAdmin, getOfficialProxyQuota } from '@/lib/social-matrix/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUsdToTwdRate } from '@/lib/fx'
import { isBillableUser } from '@/lib/marketing/billing'
import { deductCredits, getBalance } from '@/lib/skills/billing'
import { resiPackUsd } from '@/lib/social-matrix/pricing'
import { createResiSubuser, giveResiTraffic, resiApiToken, resiStickyPassword, RESI_MAX_SESSIONS_PER_SUBUSER } from '@/lib/social-matrix/iproyal'
import { officialProxyCredits, nextExpiry, OFFICIAL_PRICE_COLS } from '@/lib/social-matrix/lease-billing'

export async function GET(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const authUser = guard.user
  const { isAdmin, quota, used } = await getOfficialProxyQuota(authUser, 0)
  // usd_twd_rate：前端用來把舊資料的 monthly_price_twd 換算成 USD 顯示（點數＝美金）
  const meta = { is_admin: isAdmin, lease_quota: quota, lease_used: used, usd_twd_rate: await getUsdToTwdRate() }

  try {
    // 官方 IP 表不開放一般用戶直接讀取（RLS），一律由伺服器以 service role 查詢；
    // 非管理員只看得到上架中的 IP，且不回傳連線帳密（租用後才注入自己的代理池）
    const admin = createAdminClient()
    const offCols = isAdmin
      ? '*'
      : 'id, name, proxy_type, protocol, host, port, country, city, isp, latency_ms, monthly_price_twd, monthly_price_usd, price_per_gb_usd, is_shared, max_tenants, current_tenants_count, status, is_active, notes, created_at, updated_at'
    let offQuery = admin.from('marketing_official_proxies').select(offCols).order('created_at', { ascending: false })
    if (!isAdmin) offQuery = offQuery.eq('is_active', true)
    const { data: dbOfficial, error: offErr } = await offQuery

    // 2. Fetch user's active leases
    const { data: dbLeases } = await admin
      .from('marketing_proxy_leases')
      .select(`*, official_proxy:marketing_official_proxies(id, name, country, city, isp, is_shared, ${OFFICIAL_PRICE_COLS}), resi_account:marketing_resi_accounts(id, traffic_gb, sessions_count)`)
      .eq('user_id', authUser.id)
      .eq('status', 'active')

    // 3. 住宅代理子帳號（每位使用者共用流量；連線數未滿時新增連線免另購 GB）
    const { data: resiAccounts } = await admin
      .from('marketing_resi_accounts')
      .select('id, traffic_gb, sessions_count')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: true })

    if (offErr) return NextResponse.json({ ...meta, error: `讀取官方 IP 失敗：${offErr.message}`, official_proxies: [], leases: [] }, { status: 500 })
    return NextResponse.json({ ...meta, official_proxies: dbOfficial ?? [], leases: dbLeases ?? [], resi_accounts: resiAccounts ?? [] })
  } catch (err) {
    return NextResponse.json({ ...meta, error: `讀取官方 IP 失敗：${String(err)}`, official_proxies: [], leases: [] }, { status: 500 })
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
        monthly_price_usd,
        price_per_gb_usd,
        is_shared = false,
        max_tenants = 1,
        notes,
      } = body

      if (!host || !port || !name) {
        return NextResponse.json({ error: '請完整提供名稱、主機位址 (Host) 與通訊埠 (Port)' }, { status: 400 })
      }
      const isResidential = proxy_type === 'residential'
      if (isResidential ? !(Number(price_per_gb_usd) > 0) : !(Number(monthly_price_usd) > 0)) {
        return NextResponse.json({ error: isResidential ? '請填寫每 GB 售價 (USD)' : '請填寫月租售價 (USD)' }, { status: 400 })
      }

      const { data: createdProxy, error: createErr } = await createAdminClient()
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
          latency_ms: Number(latency_ms) || null,
          monthly_price_twd: null,
          monthly_price_usd: isResidential ? null : Number(monthly_price_usd),
          price_per_gb_usd: isResidential ? Number(price_per_gb_usd) : null,
          is_shared: !isResidential && Boolean(is_shared),
          max_tenants: isResidential ? 0 : Number(max_tenants) || 1,
          current_tenants_count: 0,
          status: 'available',
          is_active: true,
          notes,
        })
        .select()
        .single()
      if (createErr) return NextResponse.json({ error: `上架失敗：${createErr.message}` }, { status: 500 })

      return NextResponse.json({
        success: true,
        official_proxy: createdProxy,
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

      const admin = createAdminClient()
      const { data: offType } = await admin
        .from('marketing_official_proxies')
        .select('proxy_type')
        .eq('id', official_proxy_id)
        .maybeSingle()
      // 公司帳號的附贈額度依 IP 類型（ISP／住宅）分開計算
      const { isAdmin, quota, used } = await getOfficialProxyQuota(authUser, 0, offType?.proxy_type)
      const { quota: anyQuota } = quota > 0 ? { quota } : await getOfficialProxyQuota(authUser, 0)
      if (!isAdmin && anyQuota <= 0) {
        return NextResponse.json({ error: '目前方案未開放官方 IP，請升級至 PRO 以上或自備 IP' }, { status: 403 })
      }

      // 附贈額度內免費；超出以點數購買（每 30 天扣一次，到期自動續扣）
      const isPaid = !isAdmin && used >= quota
      const billable = await isBillableUser(authUser.id)
      const charge = async (name: string, priceFields: Parameters<typeof officialProxyCredits>[0]) => {
        const price = await officialProxyCredits(priceFields)
        if (price == null) return { ok: false as const, price: 0, unpriced: true as const }
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

      if (!off) return NextResponse.json({ error: '找不到此官方 IP' }, { status: 404 })
      {
        if (!off.is_active || off.status === 'maintenance') {
          return NextResponse.json({ error: '該官方 IP 目前維護保養中，暫停租用' }, { status: 409 })
        }
        const isResi = off.proxy_type === 'residential'
        // 住宅代理不限購買人數（每位買家各自一個 IPRoyal 子帳號）
        if (!isResi && (off.current_tenants_count ?? 0) >= (off.max_tenants ?? 1)) {
          return NextResponse.json({ error: '該官方 IP 目前已被其他客戶專屬租用中，暫無空位' }, { status: 409 })
        }

        // 住宅代理（附贈名額不適用）：每位使用者一個 IPRoyal 子帳號，所有國家的連線共用該子帳號流量（不過期，可加購）。
        // 每次購買新增 1 條固定 IP 連線（新 session）；子帳號連線未滿 RESI_MAX_SESSIONS_PER_SUBUSER 時可只新增連線不買 GB，
        // 首次購買或子帳號連線已滿時需購買 GB 建立新子帳號。
        type ResiAccount = { id: string; subuser_hash: string; username: string; password: string; traffic_gb: number | null; sessions_count: number | null }
        let resi: { gb: number; account: ResiAccount } | null = null
        let resiPrice = 0
        if (isResi) {
          const gb = Math.max(0, Math.floor(Number(body.gb) || 0))
          if (gb > 1000) return NextResponse.json({ error: '單次最多購買 1000 GB' }, { status: 400 })
          if (gb > 0 && !off.price_per_gb_usd) return NextResponse.json({ error: '此住宅代理尚未設定每 GB 售價' }, { status: 409 })
          const token = resiApiToken()
          if (!token) return NextResponse.json({ error: '住宅代理尚未設定 IPRoyal API 金鑰' }, { status: 409 })

          const { data: openAccounts } = await admin
            .from('marketing_resi_accounts')
            .select('*')
            .eq('user_id', authUser.id)
            .lt('sessions_count', RESI_MAX_SESSIONS_PER_SUBUSER)
            .order('created_at', { ascending: true })
            .limit(1)
          let account = (openAccounts?.[0] ?? null) as ResiAccount | null
          if (!account && gb < 1) {
            return NextResponse.json({ error: '首次購買（或連線已滿 10 條）請至少購買 1 GB 流量' }, { status: 400 })
          }

          resiPrice = gb > 0 ? resiPackUsd(Number(off.price_per_gb_usd), gb) : 0
          const chargeIt = !isAdmin && billable && resiPrice > 0
          if (chargeIt && (await getBalance(authUser.id)) < resiPrice) {
            return NextResponse.json({ error: '點數不足', required: resiPrice }, { status: 402 })
          }
          try {
            if (!account) {
              const created = await createResiSubuser(token, gb)
              const { data: inserted, error: accErr } = await admin
                .from('marketing_resi_accounts')
                .insert({ user_id: authUser.id, subuser_hash: created.hash, username: created.username, password: created.password, traffic_gb: gb, sessions_count: 0 })
                .select()
                .single()
              if (accErr || !inserted) {
                console.error('[official-proxies lease] resi account insert failed after IPRoyal create', { userId: authUser.id, hash: created.hash, accErr })
                return NextResponse.json({ error: '住宅代理帳號建立失敗，請聯繫客服' }, { status: 500 })
              }
              account = inserted as ResiAccount
            } else if (gb > 0) {
              await giveResiTraffic(token, account.subuser_hash, gb)
              await admin.from('marketing_resi_accounts')
                .update({ traffic_gb: Number(account.traffic_gb ?? 0) + gb, updated_at: new Date().toISOString() })
                .eq('id', account.id)
            }
          } catch (err) {
            console.error('[official-proxies lease] IPRoyal provisioning failed', { official_proxy_id, err })
            return NextResponse.json({ error: '住宅代理開通失敗，請稍後再試或聯繫客服' }, { status: 502 })
          }
          if (chargeIt) {
            const r = await deductCredits(authUser.id, resiPrice, `住宅代理 ${gb} GB：${off.name}`)
            if (!r.ok) console.error('[official-proxies lease] deduct failed after IPRoyal provisioning', { userId: authUser.id, official_proxy_id, price: resiPrice, account: account.id })
          }
          resi = { gb, account }
        }
        // 住宅連線一律記為付費（免費新增的連線 price 0），不佔用方案附贈名額
        const paid = isResi ? !isAdmin : isPaid

        let price = isResi ? resiPrice : 0
        if (!isResi && isPaid) {
          const c = await charge(off.name, off)
          if (!c.ok && 'unpriced' in c) return NextResponse.json({ error: '此官方 IP 尚未設定售價' }, { status: 409 })
          if (!c.ok) return NextResponse.json({ error: '點數不足', required: c.price }, { status: 402 })
          price = c.price
        }

        const { data: lease, error: leaseErr } = await admin
          .from('marketing_proxy_leases')
          .insert({
            user_id: authUser.id,
            official_proxy_id,
            status: 'active',
            is_paid: paid,
            price_credits: paid ? price : null,
            expires_at: paid && !isResi ? nextExpiry() : null,
            traffic_gb: resi ? resi.gb : null,
            resi_account_id: resi?.account.id ?? null,
          })
          .select()
          .single()
        if (leaseErr || !lease) {
          console.error('[official-proxies lease] insert failed after charge', { userId: authUser.id, official_proxy_id, price, leaseErr })
          return NextResponse.json({ error: '租用紀錄建立失敗，請聯繫客服' }, { status: 500 })
        }

        const sessionNo = resi ? Number(resi.account.sessions_count ?? 0) + 1 : 0
        const { data: proxy } = await admin.from('marketing_proxies').insert({
          user_id: authUser.id,
          lease_id: lease.id,
          name: resi ? `🌐 [官方住宅] ${off.name} #${sessionNo}` : `🏢 [官方租用] ${off.name}`,
          proxy_type: off.proxy_type,
          protocol: off.protocol,
          host: off.host,
          port: off.port,
          username: resi ? resi.account.username : off.username,
          password: resi ? resiStickyPassword(resi.account.password, off.country) : off.password,
          country: off.country,
          city: off.city,
          isp: off.isp,
          status: 'active',
          latency_ms: off.latency_ms,
          notes: off.notes,
        }).select().single()
        if (resi) {
          await admin.from('marketing_resi_accounts')
            .update({ sessions_count: sessionNo, updated_at: new Date().toISOString() })
            .eq('id', resi.account.id)
        }

        const tenants = (off.current_tenants_count ?? 0) + 1
        await admin
          .from('marketing_official_proxies')
          .update({ current_tenants_count: tenants, status: !isResi && tenants >= (off.max_tenants ?? 1) ? 'rented_out' : 'available', updated_at: new Date().toISOString() })
          .eq('id', official_proxy_id)

        const message = resi
          ? `🎉 已新增 1 條住宅固定 IP 連線${resi.gb > 0 ? `並加購 ${resi.gb} GB（扣 ${paid ? price : 0} 點）` : ''}，已放進您的代理池；所有住宅連線共用流量，用完可加購。`
          : successMessage(price)
        return NextResponse.json({ success: true, lease, proxy, charged_credits: price, message })
      }

    }

    // ==========================================
    // ACTION 3: USER TOP-UP RESIDENTIAL TRAFFIC (住宅代理加購 GB)
    // ==========================================
    if (action === 'topup') {
      const { lease_id } = body
      const gb = Math.floor(Number(body.gb))
      if (!lease_id) return NextResponse.json({ error: '請指定要加購的住宅代理' }, { status: 400 })
      if (!(gb >= 1 && gb <= 1000)) return NextResponse.json({ error: '請輸入 1–1000 GB' }, { status: 400 })

      const admin = createAdminClient()
      const { data: lease } = await admin
        .from('marketing_proxy_leases')
        .select('id, resi_account_id, official_proxy:marketing_official_proxies(id, name, price_per_gb_usd)')
        .eq('id', lease_id)
        .eq('user_id', authUser.id)
        .eq('status', 'active')
        .maybeSingle()
      const off = (Array.isArray(lease?.official_proxy) ? lease?.official_proxy[0] : lease?.official_proxy) as
        { name: string; price_per_gb_usd: number | null } | null | undefined
      const { data: account } = lease?.resi_account_id
        ? await admin.from('marketing_resi_accounts').select('id, subuser_hash, traffic_gb').eq('id', lease.resi_account_id).eq('user_id', authUser.id).maybeSingle()
        : { data: null }
      if (!lease || !off || !account) {
        return NextResponse.json({ error: '找不到此住宅代理' }, { status: 404 })
      }
      const token = resiApiToken()
      if (!off.price_per_gb_usd || !token) return NextResponse.json({ error: '此住宅代理尚未設定售價或 API 金鑰' }, { status: 409 })

      const isAdmin = await isPlatformAdmin(authUser)
      const price = resiPackUsd(Number(off.price_per_gb_usd), gb)
      const chargeIt = !isAdmin && await isBillableUser(authUser.id)
      if (chargeIt && (await getBalance(authUser.id)) < price) {
        return NextResponse.json({ error: '點數不足', required: price }, { status: 402 })
      }
      try {
        await giveResiTraffic(token, account.subuser_hash, gb)
      } catch (err) {
        console.error('[official-proxies topup] IPRoyal give-traffic failed', { lease_id, err })
        return NextResponse.json({ error: '加購失敗，請稍後再試或聯繫客服' }, { status: 502 })
      }
      if (chargeIt) {
        const r = await deductCredits(authUser.id, price, `住宅代理加購 ${gb} GB：${off.name}`)
        if (!r.ok) console.error('[official-proxies topup] deduct failed after IPRoyal give-traffic', { userId: authUser.id, lease_id, price })
      }
      const total = Number(account.traffic_gb ?? 0) + gb
      await admin.from('marketing_resi_accounts').update({ traffic_gb: total, updated_at: new Date().toISOString() }).eq('id', account.id)
      return NextResponse.json({ success: true, traffic_gb: total, charged_credits: chargeIt ? price : 0, message: `🎉 已加購 ${gb} GB，累計 ${total} GB` })
    }

    return NextResponse.json({ error: '不支援的操作類型' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: `處理失敗: ${String(err)}` }, { status: 500 })
  }
}
