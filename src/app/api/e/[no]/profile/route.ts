import { NextRequest, NextResponse } from 'next/server'
import { portalEmployee } from '../_auth'
import { RESUME_FIELDS, candidateForEmployee, profileOpen } from '@/lib/hr/profile'
import { notifyHR } from '@/lib/hr/notify'

type Ctx = { params: Promise<{ no: string }> }

// 隨時可改（聯絡方式）
const FREE_EMP = ['phone', 'address'] as const
// 人事關閉或過期後不可改
const LOCKED_EMP = ['email', 'birthday', 'id_number', 'id_issue_date', 'id_issue_place', 'bank_name', 'bank_account', 'tax_code'] as const
const DATE_FIELDS = new Set(['birthday', 'id_issue_date'])
// 這些欄位變更時通知人事
const WATCH: Record<string, string> = { bank_name: '銀行', bank_account: '銀行帳號', tax_code: '稅號', id_number: '身分證號', birthday: '生日' }
// 同步寫回人員資料（應徵資料）的欄位
const SYNC_CAND = ['phone', 'address', 'email', 'birthday', 'id_number'] as const

const EMP_COLS = 'name, phone, email, address, birthday, id_number, id_issue_date, id_issue_place, bank_name, bank_account, tax_code, position, store'
const CAND_COLS = 'id, gender, native_place, education, resume_text, notify_channel, identity_locked, profile_edit_until'
const norm = (v: unknown) => (v === null || v === undefined ? '' : String(v))

async function load(ctx: NonNullable<Awaited<ReturnType<typeof portalEmployee>>>) {
  const { admin, company, emp } = ctx
  const cid = await candidateForEmployee(admin, company.ownerId, emp, false)
  const [{ data: e }, { data: c }] = await Promise.all([
    admin.from('hr_employees').select(EMP_COLS).eq('id', emp.id).single(),
    cid ? admin.from('agent_hr_candidates').select(CAND_COLS).eq('id', cid).single() : Promise.resolve({ data: null }),
  ])
  return { e: (e ?? {}) as Record<string, unknown>, c: c as Record<string, unknown> | null, cid }
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { e, c } = await load(ctx)
  const open = profileOpen((c ?? {}) as { identity_locked?: boolean; profile_edit_until?: string | null })
  return NextResponse.json({
    profile: {
      ...e,
      gender: c?.gender ?? '', native_place: c?.native_place ?? '', education: c?.education ?? '',
      resume_text: c?.resume_text ?? '', notify_channel: c?.notify_channel ?? 'email',
    },
    open, until: open ? (c?.profile_edit_until ?? null) : null,
  })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { admin, company, emp } = ctx
  const b = await req.json().catch(() => ({}))
  const { e, c } = await load(ctx)
  const open = profileOpen((c ?? {}) as { identity_locked?: boolean; profile_edit_until?: string | null })
  const closedErr = NextResponse.json({ error: 'Đã khóa chỉnh sửa, vui lòng liên hệ nhân sự / 履歷修改已關閉，請聯繫人事開放' }, { status: 403 })

  const empUp: Record<string, unknown> = {}, candUp: Record<string, unknown> = {}
  for (const f of [...FREE_EMP, ...LOCKED_EMP]) {
    if (b[f] === undefined) continue
    const v = DATE_FIELDS.has(f) ? (b[f] || null) : String(b[f] ?? '').trim().slice(0, 300)
    if (norm(v) === norm(e[f])) continue
    if (!open && (LOCKED_EMP as readonly string[]).includes(f)) return closedErr
    empUp[f] = v
  }
  for (const f of RESUME_FIELDS) {
    if (b[f] === undefined) continue
    const v = String(b[f] ?? '').slice(0, f === 'resume_text' ? 5000 : 200)
    if (norm(v) === norm(c?.[f])) continue
    if (!open) return closedErr
    candUp[f] = v
  }
  if (b.notify_channel !== undefined && b.notify_channel !== norm(c?.notify_channel)) {
    if (b.notify_channel !== 'email' && b.notify_channel !== 'zalo') return NextResponse.json({ error: 'notify_channel' }, { status: 400 })
    candUp.notify_channel = b.notify_channel
  }
  for (const f of SYNC_CAND) if (empUp[f] !== undefined) candUp[f] = empUp[f] ?? (f === 'birthday' ? null : '')
  if (Object.keys(empUp).length === 0 && Object.keys(candUp).length === 0) return NextResponse.json({ ok: true })

  if (Object.keys(empUp).length) {
    const { error } = await admin.from('hr_employees').update(empUp).eq('id', emp.id).eq('owner_id', company.ownerId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (Object.keys(candUp).length) {
    const cid = await candidateForEmployee(admin, company.ownerId, emp, true)
    if (cid) await admin.from('agent_hr_candidates').update({ ...candUp, resume_updated_at: new Date().toISOString() }).eq('id', cid)
  }
  const watched = Object.keys(empUp).filter(f => WATCH[f]).map(f => WATCH[f])
  if (watched.length) {
    await notifyHR(company.ownerId, {
      kind: 'employee_profile_updated',
      title: `✏️ ${emp.name} 更新了個人資料`,
      body: `${emp.name}（${emp.attendance_no}）於員工專區修改：${watched.join('、')}，請確認。`,
    }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
