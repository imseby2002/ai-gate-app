import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
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
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp = new URL(req.url).searchParams
  const year = parseInt(sp.get('year') ?? '') || new Date().getFullYear()
  const month = parseInt(sp.get('month') ?? '') || (new Date().getMonth() + 1)

  const { data, error } = await supabase
    .from('hr_evaluations')
    .select('*')
    .eq('owner_id', user.id).eq('year', year).eq('month', month)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ evaluations: data ?? [] })
}

// 建立/更新單一員工的評估表（依 employee+year+month upsert）
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const employee_id = String(body.employee_id ?? '')
  const year = parseInt(body.year) || 0
  const month = parseInt(body.month) || 0
  if (!employee_id || !year || month < 1 || month > 12) {
    return NextResponse.json({ error: 'employee_id / year / month 為必填' }, { status: 400 })
  }

  const { items, reward, penalty } = normItems(body.items)
  const { data, error } = await supabase
    .from('hr_evaluations')
    .upsert({
      owner_id: user.id, employee_id, year, month,
      rating: String(body.rating ?? ''),
      bonus: Number(body.bonus) || 0,
      items, reward_total: reward, penalty_total: penalty,
      notes: String(body.notes ?? ''),
      evaluator: String(body.evaluator ?? ''),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,employee_id,year,month' })
    .select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ evaluation: data })
}
