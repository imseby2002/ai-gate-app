// GET   /api/admin/company-social-resources — 列出公司與其社群矩陣資源設定、代管成員席次
// PATCH /api/admin/company-social-resources — 更新公司資源設定；action=activate 開通共享代管（一般公司版預扣一期）、suspend 暫停
// POST  /api/admin/company-social-resources — 席次管理：{ company_id, seat: { id?, login_account, login_password?, member_id? } | { delete: id } }
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encryptSecret } from '@/lib/crypto/secret'
import { isCycle } from '@/lib/connector/managed-pricing'
import {
  COMPANY_RESOURCE_DEFAULTS, defaultCompanyGroupName, activateCompanyManaged, type CompanyResources,
} from '@/lib/connector/company-resources'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

const int = (v: unknown, min: number) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= min ? n : null
}

export async function GET() {
  const guard = await assertAdmin()
  if (guard.res) return guard.res
  const admin = createAdminClient()

  const [{ data: companies, error }, { data: resources }, { data: seats }, { data: members }] = await Promise.all([
    admin.from('companies').select('id, name').order('created_at', { ascending: false }).limit(300),
    admin.from('marketing_company_social_resources').select('*'),
    admin.from('marketing_company_adspower_seats').select('id, company_id, member_id, login_account, login_password_enc, created_at').order('created_at'),
    admin.from('company_members').select('company_id, member_id, invited_email, role').eq('status', 'active'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enterprise = await Promise.all((companies ?? []).map(async c => {
    const { data } = await admin.rpc('company_enterprise_active', { p_company_id: c.id })
    return [c.id, !!data] as const
  }))
  const entMap = new Map(enterprise)
  const resMap = new Map((resources ?? []).map(r => [r.company_id, r]))

  return NextResponse.json({
    companies: (companies ?? []).map(c => ({
      ...c,
      enterprise: entMap.get(c.id) ?? false,
      resources: resMap.get(c.id) ?? { company_id: c.id, ...COMPANY_RESOURCE_DEFAULTS, group_name: null },
      default_group_name: defaultCompanyGroupName(c.id),
      seats: (seats ?? []).filter(s => s.company_id === c.id).map(({ login_password_enc, ...s }) => ({ ...s, has_password: !!login_password_enc })),
      members: (members ?? []).filter(m => m.company_id === c.id && m.member_id),
    })),
  })
}

export async function PATCH(req: NextRequest) {
  const guard = await assertAdmin()
  if (guard.res) return guard.res
  const body = await req.json().catch(() => ({}))
  const companyId = String(body.company_id ?? '')
  if (!companyId) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const update: Record<string, unknown> = { company_id: companyId, updated_at: new Date().toISOString() }
  for (const [k, min] of [['isp_gift', 0], ['residential_gift', 0], ['env_quota', 1], ['member_seats', 1]] as const) {
    if (body[k] === undefined) continue
    const n = int(body[k], min)
    if (n === null) return NextResponse.json({ error: `${k} 數值不正確` }, { status: 400 })
    update[k] = n
  }
  if (body.adspower_mode !== undefined) {
    if (!['own', 'managed'].includes(body.adspower_mode)) return NextResponse.json({ error: 'adspower_mode 不正確' }, { status: 400 })
    update.adspower_mode = body.adspower_mode
  }
  if (body.billing_cycle !== undefined) {
    if (!isCycle(body.billing_cycle)) return NextResponse.json({ error: '付款週期不正確' }, { status: 400 })
    update.billing_cycle = body.billing_cycle
  }
  if (typeof body.auto_renew === 'boolean') update.auto_renew = body.auto_renew
  if (typeof body.group_name === 'string') update.group_name = body.group_name.trim().slice(0, 100) || null
  if (typeof body.admin_note === 'string') update.admin_note = body.admin_note.trim().slice(0, 1000) || null
  if (body.action === 'suspend') update.status = 'suspended'
  if (body.action === 'deactivate') update.status = 'inactive'

  const admin = createAdminClient()
  const { data: saved, error } = await admin
    .from('marketing_company_social_resources')
    .upsert(update)
    .select('*')
    .single()
  if (error || !saved) return NextResponse.json({ error: error?.message ?? '儲存失敗' }, { status: 500 })

  if (body.action === 'activate') {
    const r = saved as CompanyResources
    if (r.adspower_mode !== 'managed') return NextResponse.json({ error: '請先將 AdsPower 模式設為共享代管' }, { status: 400 })
    const charge = await activateCompanyManaged(admin, r)
    if (!charge.ok) {
      const insufficient = charge.reason === 'insufficient'
      return NextResponse.json(
        { error: insufficient ? `公司點數不足（需 ${charge.price} 點），尚未開通` : '扣款失敗，尚未開通' },
        { status: insufficient ? 402 : 500 },
      )
    }
    return NextResponse.json({ ok: true, charged: charge.price })
  }
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const guard = await assertAdmin()
  if (guard.res) return guard.res
  const body = await req.json().catch(() => ({}))
  const companyId = String(body.company_id ?? '')
  const seat = body.seat ?? {}
  if (!companyId) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  const admin = createAdminClient()

  if (seat.delete) {
    const { error } = await admin.from('marketing_company_adspower_seats').delete().eq('id', seat.delete).eq('company_id', companyId)
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true })
  }

  const loginAccount = String(seat.login_account ?? '').trim().slice(0, 200)
  if (!loginAccount) return NextResponse.json({ error: '請填入 AdsPower 成員登入帳號' }, { status: 400 })
  const memberId = seat.member_id ? String(seat.member_id) : null
  if (memberId) {
    const { data: m } = await admin
      .from('company_members').select('id').eq('company_id', companyId).eq('member_id', memberId).eq('status', 'active').maybeSingle()
    if (!m) return NextResponse.json({ error: '指派對象不是此公司的在職成員' }, { status: 400 })
  }

  const row: Record<string, unknown> = { company_id: companyId, login_account: loginAccount, member_id: memberId }
  if (typeof seat.login_password === 'string' && seat.login_password) row.login_password_enc = encryptSecret(seat.login_password)

  if (seat.id) {
    const { error } = await admin.from('marketing_company_adspower_seats').update(row).eq('id', seat.id).eq('company_id', companyId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const [{ data: res }, { count }] = await Promise.all([
    admin.from('marketing_company_social_resources').select('member_seats').eq('company_id', companyId).maybeSingle(),
    admin.from('marketing_company_adspower_seats').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
  ])
  const limit = res?.member_seats ?? COMPANY_RESOURCE_DEFAULTS.member_seats
  if ((count ?? 0) >= limit) return NextResponse.json({ error: `已達成員席次上限（${limit}），請先調高席次` }, { status: 400 })

  const { error } = await admin.from('marketing_company_adspower_seats').insert(row)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
