import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { releaseLease } from '@/lib/social-matrix/lease-billing'
import { requireSocialMatrix } from '@/lib/social-matrix/access'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const authUser = guard.user

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing Lease ID' }, { status: 400 })

  try {
    // 以資料庫為準：改狀態、移除代理池節點、空出官方名額；已扣的點數不退（租期內提前退租）
    const admin = createAdminClient()
    const { data: lease } = await admin
      .from('marketing_proxy_leases')
      .select('id, official_proxy_id, resi_account_id')
      .eq('id', id)
      .eq('user_id', authUser.id)
      .eq('status', 'active')
      .maybeSingle()
    if (lease) {
      await releaseLease(admin, lease, 'canceled')
      // 住宅代理：移除這條連線，子帳號流量保留，連線名額空出
      if (lease.resi_account_id) {
        const { data: acct } = await admin.from('marketing_resi_accounts').select('sessions_count').eq('id', lease.resi_account_id).maybeSingle()
        if (acct) {
          await admin.from('marketing_resi_accounts')
            .update({ sessions_count: Math.max(0, Number(acct.sessions_count ?? 1) - 1), updated_at: new Date().toISOString() })
            .eq('id', lease.resi_account_id)
        }
      }
      return NextResponse.json({ success: true, message: '已成功解除該官方 IP 租用，並自代理池移除！' })
    }

    return NextResponse.json({ error: '找不到此租用紀錄' }, { status: 404 })
  } catch (err) {
    return NextResponse.json({ error: `退租失敗: ${String(err)}` }, { status: 500 })
  }
}
