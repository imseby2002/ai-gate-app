import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny, storeAllowed, type UnitContext } from '@/lib/auth/unit-access'
import { normKind, normTiers, tierAmount } from '@/lib/hr/eval-tiers'

// 人事可評全部員工；門市／門市領班只能評所屬門市的員工（未綁門市的門市帳號不限門市）
async function getAdminUser() {
  const ctx = await getUnitContextAny(['hr', 'store', 'store_leader'])
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin , status: ctx.status, ctx }
  const fullHr = ctx.isAdmin || (ctx.units ?? []).includes('hr')
  // 只有領班身分卻沒綁門市：不給看
  if (!fullHr && !(ctx.units ?? []).includes('store') && !ctx.storeCodes) return { user: null, supabase: ctx.admin, status: 403 as const, ctx }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin , status: ctx.status, ctx, fullHr }
}

// 可評估的員工 id：fullHr 為 null（不限）；否則為範圍內門市的員工
async function scopedEmployeeIds(ctx: UnitContext, fullHr: boolean, store: string): Promise<string[] | null> {
  if (fullHr && !store) return null
  let q = ctx.admin.from('hr_employees').select('id, store').eq('owner_id', ctx.ownerId)
  if (store) q = q.eq('store', store)
  else if (ctx.storeCodes) q = q.in('store', ctx.storeCodes)
  else q = q.not('store', 'is', null).neq('store', '')
  const { data } = await q
  return (data ?? []).map(e => e.id as string)
}

type Item = { kind: 'reward' | 'penalty'; label: string; amount: number }

function normItems(raw: unknown): { items: Item[]; reward: number; penalty: number } {
  const arr = Array.isArray(raw) ? raw : []
  const items: Item[] = []
  let reward = 0, penalty = 0
  for (const r of arr) {
    const o = r as Record<string, unknown>
    const kind = o.kind === 'penalty' ? 'penalty' : 'reward'
    const amount = Math.max(0, Number(o.amount) || 0)
    const label = String(o.label ?? '').slice(0, 100)
    if (amount === 0 && !label) continue
    items.push({ kind, label, amount })
    if (kind === 'reward') reward += amount; else penalty += amount
  }
  return { items, reward, penalty }
}

// 列出某年月的評估表。query: year, month
export async function GET(req: NextRequest) {
  const { user, supabase , status, ctx, fullHr } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

  const sp = new URL(req.url).searchParams
  const store = (sp.get('store') ?? '').trim()
  if (store && !fullHr && !storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const ids = await scopedEmployeeIds(ctx, !!fullHr, store)
  if (ids && ids.length === 0) return NextResponse.json({ evaluations: [] })
  const year = parseInt(sp.get('year') ?? '') || new Date().getFullYear()
  const month = parseInt(sp.get('month') ?? '') || (new Date().getMonth() + 1)
  const kind = sp.get('kind') // 未指定＝兩種都回（薪資彙整用）

  let q = supabase
    .from('hr_evaluations')
    .select('*')
    .eq('owner_id', user.id).eq('year', year).eq('month', month)
  if (ids) q = q.in('employee_id', ids)
  if (kind) q = q.eq('kind', normKind(kind))
  const [{ data, error }, { data: st }] = await Promise.all([
    q,
    supabase.from('hr_settings').select('eval_tiers').eq('owner_id', user.id).maybeSingle(),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ evaluations: data ?? [], tiers: normTiers(st?.eval_tiers) })
}

// 建立/更新單一員工的評估表（依 employee+year+month upsert）
export async function POST(req: NextRequest) {
  const { user, supabase , status, ctx, fullHr } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

  const body = await req.json().catch(() => ({}))
  const employee_id = String(body.employee_id ?? '')
  const year = parseInt(body.year) || 0
  const month = parseInt(body.month) || 0
  if (!employee_id || !year || month < 1 || month > 12) {
    return NextResponse.json({ error: 'employee_id / year / month 為必填' }, { status: 400 })
  }

  const { data: emp } = await supabase.from('hr_employees').select('id, store').eq('id', employee_id).eq('owner_id', user.id).maybeSingle()
  if (!emp) return NextResponse.json({ error: 'employee not found' }, { status: 404 })
  if (!fullHr && (ctx.storeCodes ? !storeAllowed(ctx, emp.store as string) : !emp.store)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 辦公室評分只限人事／管理者；門市領班只能做領班評分
  const kind = normKind(body.kind)
  if (kind === 'office' && !fullHr) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const rating = String(body.rating ?? '').trim()
  const { data: st } = await supabase.from('hr_settings').select('eval_tiers').eq('owner_id', user.id).maybeSingle()

  const { items, reward, penalty } = normItems(body.items)
  const { data, error } = await supabase
    .from('hr_evaluations')
    .upsert({
      owner_id: user.id, employee_id, year, month, kind,
      rating,
      tier_amount: tierAmount(normTiers(st?.eval_tiers), kind, rating),
      bonus: Number(body.bonus) || 0,
      items, reward_total: reward, penalty_total: penalty,
      notes: String(body.notes ?? ''),
      evaluator: String(body.evaluator ?? ''),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,employee_id,year,month,kind' })
    .select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ evaluation: data })
}
