import { NextRequest, NextResponse } from 'next/server'
import type { createClient } from '@/lib/supabase/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { notifyHR } from '@/lib/hr/notify'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

type Emp = {
  id: string; name: string; staff_category: string; store: string
  base_salary: number; insurance_required: boolean; insurance_status: string; insurance_salary: number
}
type Pay = { employee_id: string; base_salary: number; allowances: number; bonus: number }

// 依規則判定是否需投保：正職一律需要；工讀依政策（全員 or 當月薪資超過門檻）
function computeNeed(emp: Emp, monthly: number, mode: string, threshold: number): boolean {
  if (emp.staff_category === 'fulltime') return true
  if (mode === 'all') return true
  return monthly > threshold
}

async function build(supabase: Awaited<ReturnType<typeof createClient>>, ownerId: string, year: number, month: number) {
  const [{ data: emps }, { data: pays }, { data: setting }] = await Promise.all([
    supabase.from('hr_employees')
      .select('id, name, staff_category, store, base_salary, insurance_required, insurance_status, insurance_salary')
      .eq('owner_id', ownerId).eq('status', 'active'),
    supabase.from('hr_payroll').select('employee_id, base_salary, allowances, bonus')
      .eq('owner_id', ownerId).eq('year', year).eq('month', month),
    supabase.from('hr_settings').select('insurance_mode, insurance_threshold').eq('owner_id', ownerId).single(),
  ])
  const mode = setting?.insurance_mode ?? 'threshold'
  const threshold = Number(setting?.insurance_threshold) || 5000000
  const payMap: Record<string, Pay> = {}
  for (const p of (pays ?? []) as Pay[]) payMap[p.employee_id] = p

  const rows = ((emps ?? []) as Emp[]).map(e => {
    const p = payMap[e.id]
    const monthly = p ? (Number(p.base_salary) || 0) + (Number(p.allowances) || 0) + (Number(p.bonus) || 0) : (Number(e.base_salary) || 0)
    const need = computeNeed(e, monthly, mode, threshold)
    return {
      id: e.id, name: e.name, staff_category: e.staff_category, store: e.store,
      monthly, need, insurance_required: e.insurance_required, insurance_status: e.insurance_status,
    }
  })
  return { rows, mode, threshold }
}

// 預覽：當月每位員工的投保判定
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const year = parseInt(sp.get('year') ?? '') || new Date().getFullYear()
  const month = parseInt(sp.get('month') ?? '') || (new Date().getMonth() + 1)
  const { rows, mode, threshold } = await build(supabase, user.id, year, month)
  return NextResponse.json({ rows, mode, threshold, year, month })
}

// 重新彙整：把「需投保但尚未標記」者設為 insurance_required，並通知人事
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const year = parseInt(body.year) || new Date().getFullYear()
  const month = parseInt(body.month) || (new Date().getMonth() + 1)

  const { rows } = await build(supabase, user.id, year, month)
  const newly = rows.filter(r => r.need && !r.insurance_required)

  for (const r of newly) {
    await supabase.from('hr_employees')
      .update({
        insurance_required: true,
        insurance_status: r.insurance_status === 'none' || !r.insurance_status ? 'pending' : r.insurance_status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', r.id).eq('owner_id', user.id)
  }

  if (newly.length > 0) {
    await notifyHR(user.id, {
      kind: 'insurance_needed',
      title: '🛡️ 新增需投保名單',
      body: `${year}/${month} 依當月薪資判定，新增 ${newly.length} 人需投保：${newly.map(n => n.name).join('、')}。請至保險頁確認並辦理。`,
    }).catch(() => {})
  }

  return NextResponse.json({ newly: newly.map(n => n.name), newly_count: newly.length })
}
