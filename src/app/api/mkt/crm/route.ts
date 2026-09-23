import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() {
  return await getUnitContextAny(['mkt', 'marketing', 'store'])
}

const s = (v: unknown) => String(v ?? '').trim()
const TIERS = ['general', 'silver', 'gold', 'vip', 'vvip']

export async function GET(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const sp = new URL(req.url).searchParams
  const qStr = s(sp.get('q'))
  const tier = s(sp.get('tier'))
  const limit = Math.min(200, Math.max(1, Number(sp.get('limit')) || 100))

  let q = c.admin
    .from('crm_customers')
    .select('*')
    .eq('owner_id', c.ownerId)

  if (tier && TIERS.includes(tier)) {
    q = q.eq('tier', tier)
  }

  if (qStr) {
    q = q.or(`phone.ilike.%${qStr}%,name.ilike.%${qStr}%`)
  }

  const { data, error } = await q
    .order('total_spend', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 統計總會員數與 VIP 人數
  const { data: allTiers } = await c.admin
    .from('crm_customers')
    .select('tier, total_spend')
    .eq('owner_id', c.ownerId)

  const summary = {
    total: allTiers?.length ?? 0,
    vipCount: allTiers?.filter(x => x.tier === 'vip' || x.tier === 'vvip').length ?? 0,
    goldCount: allTiers?.filter(x => x.tier === 'gold').length ?? 0,
    totalCustomerSpend: allTiers?.reduce((acc, x) => acc + (Number(x.total_spend) || 0), 0) ?? 0,
  }

  return NextResponse.json({ items: data ?? [], summary })
}

export async function POST(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const b = await req.json().catch(() => ({}))

  // 支援單筆新增或批次匯入
  if (Array.isArray(b.customers)) {
    const filename = s(b.filename) || 'crm_customers.xlsx'
    const rows = b.customers.map((item: any) => {
      let tierVal = s(item.tier).toLowerCase()
      if (['vip', '尊榮vip', '尊榮 vip', 'vip顧客'].includes(tierVal)) tierVal = 'vip'
      else if (['vvip', '黑卡vvip', '黑卡 vvip'].includes(tierVal)) tierVal = 'vvip'
      else if (['gold', '黃金', '黃金會員', '金卡'].includes(tierVal)) tierVal = 'gold'
      else if (['silver', '白銀', '白銀會員', '銀卡'].includes(tierVal)) tierVal = 'silver'
      else if (!TIERS.includes(tierVal)) tierVal = 'general'

      let tagsVal: string[] = []
      if (Array.isArray(item.tags)) {
        tagsVal = item.tags.map((t: any) => s(t)).filter(Boolean)
      } else if (typeof item.tags === 'string' && item.tags.trim()) {
        tagsVal = item.tags.split(/[,，、]+/).map((t: string) => t.trim()).filter(Boolean)
      }

      return {
        owner_id: c.ownerId,
        phone: s(item.phone),
        name: s(item.name),
        email: s(item.email),
        line_uid: s(item.line_uid),
        zalo_id: s(item.zalo_id),
        tier: tierVal,
        tags: tagsVal,
        total_spend: Number(item.total_spend) || 0,
        order_count: Number(item.order_count) || 0,
        notes: s(item.notes),
      }
    }).filter((item: any) => item.phone)

    if (rows.length === 0) return NextResponse.json({ error: '無有效會員資料可匯入（每筆需包含手機號碼）' }, { status: 400 })

    const { data, error } = await c.admin
      .from('crm_customers')
      .upsert(rows, { onConflict: 'owner_id,phone' })
      .select()

    if (error) {
      await c.admin.from('mkt_integration_sync_logs').insert({
        owner_id: c.ownerId,
        system_type: 'crm',
        sync_type: 'upload',
        status: 'failed',
        filename,
        records_count: rows.length,
        error_message: error.message,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 紀錄 CRM 匯入日誌
    await c.admin.from('mkt_integration_sync_logs').insert({
      owner_id: c.ownerId,
      system_type: 'crm',
      sync_type: 'upload',
      status: 'success',
      filename,
      records_count: rows.length,
      meta: {
        vip_count: rows.filter((r: any) => r.tier === 'vip' || r.tier === 'vvip').length,
      },
    })

    const count = data?.length ?? rows.length
    return NextResponse.json({
      ok: true,
      count,
      inserted: count,
      updated: count,
      imported: count,
    })
  }

  const phone = s(b.phone)
  if (!phone) return NextResponse.json({ error: '手機號碼必填' }, { status: 400 })

  const { data, error } = await c.admin
    .from('crm_customers')
    .upsert({
      owner_id: c.ownerId,
      phone,
      name: s(b.name),
      email: s(b.email),
      line_uid: s(b.line_uid),
      zalo_id: s(b.zalo_id),
      tier: TIERS.includes(s(b.tier)) ? s(b.tier) : 'general',
      tags: Array.isArray(b.tags) ? b.tags : [],
      total_spend: Number(b.total_spend) || 0,
      order_count: Number(b.order_count) || 0,
      notes: s(b.notes),
    }, { onConflict: 'owner_id,phone' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, customer: data })
}

export async function PATCH(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.name !== undefined) upd.name = s(b.name)
  if (b.email !== undefined) upd.email = s(b.email)
  if (b.line_uid !== undefined) upd.line_uid = s(b.line_uid)
  if (b.zalo_id !== undefined) upd.zalo_id = s(b.zalo_id)
  if (b.tier !== undefined && TIERS.includes(s(b.tier))) upd.tier = s(b.tier)
  if (b.tags !== undefined && Array.isArray(b.tags)) upd.tags = b.tags
  if (b.total_spend !== undefined) upd.total_spend = Number(b.total_spend) || 0
  if (b.order_count !== undefined) upd.order_count = Number(b.order_count) || 0
  if (b.notes !== undefined) upd.notes = s(b.notes)

  const { data, error } = await c.admin
    .from('crm_customers')
    .update(upd)
    .eq('id', id)
    .eq('owner_id', c.ownerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, customer: data })
}

export async function DELETE(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await c.admin.from('crm_customers').delete().eq('id', s(id)).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
