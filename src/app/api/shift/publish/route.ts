import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getShiftContext, storeAllowed } from '@/lib/shift/scope'
import { fmtMin, isDate, weekdayOf } from '@/lib/shift/time'
import { portalUrlForEmployee } from '@/lib/hr/portal'

const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const WD_ZH = ['日', '一', '二', '三', '四', '五', '六']

// 發布班表：把期間內的草稿班改為已發布，通知有班的員工（站內＋Email）。body: { store, from, to }
export async function POST(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const b = await req.json().catch(() => ({}))
  const store = String(b.store ?? '').trim(), from = String(b.from ?? ''), to = String(b.to ?? '')
  if (!store || !isDate(from) || !isDate(to) || to < from) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  if (!storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = ctx.admin, owner = ctx.ownerId

  const { data: drafts } = await db.from('shift_plans').select('employee_id')
    .eq('owner_id', owner).eq('store', store).eq('status', 'draft').gte('work_date', from).lte('work_date', to)
  const changed = new Set((drafts ?? []).map(d => d.employee_id))
  if (changed.size === 0) return NextResponse.json({ ok: true, published: 0, employees: 0, emailed: 0 })

  const { error } = await db.from('shift_plans').update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('owner_id', owner).eq('store', store).eq('status', 'draft').gte('work_date', from).lte('work_date', to)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 通知班表有變動的員工，內容為其期間內完整班表
  const [{ data: plans }, { data: emps }] = await Promise.all([
    db.from('shift_plans').select('employee_id, work_date, start_min, end_min')
      .eq('owner_id', owner).eq('store', store).gte('work_date', from).lte('work_date', to).in('employee_id', [...changed]).order('work_date').order('start_min'),
    db.from('hr_employees').select('id, name, email, attendance_no').eq('owner_id', owner).in('id', [...changed]),
  ])
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  let emailed = 0
  for (const e of emps ?? []) {
    const lines = (plans ?? []).filter(p => p.employee_id === e.id)
      .map(p => `・${p.work_date}（${WD[weekdayOf(p.work_date)]}/${WD_ZH[weekdayOf(p.work_date)]}）${fmtMin(p.start_min)}–${fmtMin(p.end_min)}`)
    const url = await portalUrlForEmployee(owner, e.attendance_no)
    const body = `${e.name}\nLịch làm ${store} / 班表 ${store}：${from} ~ ${to}\n${lines.join('\n') || '—'}${url ? `\n\n${url}` : ''}`
    await db.from('hr_notifications').insert({ owner_id: owner, kind: 'shift_confirmed', title: `🗓️ ${store} 班表已發布：${e.name}`, body })
    if (e.email && resend) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'AI Gate <hr@im-tourist.com>',
          to: [e.email], subject: `Lịch làm / 班表 ${store} ${from} ~ ${to}`, text: body,
        })
        emailed++
      } catch { /* best-effort */ }
    }
  }
  return NextResponse.json({ ok: true, published: drafts?.length ?? 0, employees: changed.size, emailed })
}
