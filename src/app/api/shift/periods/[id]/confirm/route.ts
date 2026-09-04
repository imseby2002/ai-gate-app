import { getUnitContext } from '@/lib/auth/unit-access'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { sanitizeSlots, weekday } from '@/lib/shift/util'

type Ctx = { params: Promise<{ id: string }> }

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

// 確認排班：狀態設為 confirmed，並把各員工的班表寄送（Email）。
export async function POST(_req: Request, { params }: Ctx) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const { id } = await params
  const { data: period } = await supabase.from('shift_periods')
    .select('store, title, start_date, end_date, slots').eq('id', id).eq('owner_id', user.id).single()
  if (!period) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const slots = sanitizeSlots(period.slots)
  const slotLabel = new Map(slots.map(s => [s.code, s.label]))
  const [{ data: assigns }, { data: tokens }] = await Promise.all([
    supabase.from('shift_assignments').select('employee_id, work_date, slot_code').eq('owner_id', user.id).eq('period_id', id),
    supabase.from('shift_tokens').select('employee_id, employee_name').eq('owner_id', user.id).eq('period_id', id),
  ])
  const empIds = [...new Set((assigns ?? []).map(a => a.employee_id))]
  const { data: emps } = empIds.length
    ? await supabase.from('hr_employees').select('id, name, email').eq('owner_id', user.id).in('id', empIds)
    : { data: [] }
  const emailOf = new Map((emps ?? []).map(e => [e.id, e.email as string]))
  const nameOf = new Map((tokens ?? []).map(t => [t.employee_id, t.employee_name]))

  // 依員工彙整班表
  const byEmp = new Map<string, { date: string; slot: string }[]>()
  for (const a of assigns ?? []) {
    ;(byEmp.get(a.employee_id) ?? byEmp.set(a.employee_id, []).get(a.employee_id)!)
      .push({ date: a.work_date, slot: slotLabel.get(a.slot_code) || a.slot_code })
  }

  const title = period.title || `${period.start_date} ~ ${period.end_date}`
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  let sent = 0
  for (const [empId, rows] of byEmp) {
    const email = emailOf.get(empId)
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.slot < b.slot ? -1 : 1))
    const lines = rows.map(r => `・${r.date}（${weekday(r.date)}）${r.slot}`).join('\n')
    const body = `${nameOf.get(empId) || ''} 您好，\n\n${period.store} ${title} 已排定您的班表：\n${lines}\n\n如有問題請聯繫門市管理。`
    // 站內留存（owner 端）
    await supabase.from('hr_notifications').insert({
      owner_id: user.id, kind: 'shift_confirmed',
      title: `🗓️ 班表已發送：${nameOf.get(empId) || empId}`, body,
    })
    if (email && resend) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'AI Gate <hr@im-tourist.com>',
          to: [email], subject: `【班表】${period.store} ${title}`, text: body,
        })
        sent++
      } catch { /* best-effort */ }
    }
  }

  await supabase.from('shift_periods').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', user.id)
  return NextResponse.json({ ok: true, employees: byEmp.size, emailed: sent })
}
