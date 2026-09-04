import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { DOC_CATALOG, APPLY_BUCKET } from '@/lib/hr/apply'

const s = (v: unknown) => String(v ?? '').trim()
// 必備文件＝目錄中除「其他」外皆須備齊
const REQUIRED_TYPES = DOC_CATALOG.filter(d => d.type !== 'other').map(d => d.type)

// 人員可編輯的基本資料欄位
const PERSON_FIELDS = ['name', 'gender', 'native_place', 'birthday', 'id_number', 'education', 'email', 'company_email', 'zalo_user_id', 'payroll_no', 'position', 'store', 'staff_category', 'address', 'phone'] as const

export async function GET(req: NextRequest) {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const { admin, ownerId } = ctx
  const id = s(new URL(req.url).searchParams.get('id'))

  if (!id) {
    // 清單：人員 ＋ 文件齊全度
    const { data: people } = await admin.from('agent_hr_candidates')
      .select('id, name, position, store, staff_category, stage, hired_employee_id, apply_token')
      .eq('user_id', ownerId).order('created_at', { ascending: false })
    const ids = (people ?? []).map(p => p.id)
    const { data: docs } = ids.length
      ? await admin.from('hr_candidate_documents').select('candidate_id, doc_type').in('candidate_id', ids)
      : { data: [] }
    const byCand = new Map<string, Set<string>>()
    for (const d of docs ?? []) { (byCand.get(d.candidate_id) ?? byCand.set(d.candidate_id, new Set()).get(d.candidate_id)!).add(d.doc_type) }
    const list = (people ?? []).map(p => {
      const have = byCand.get(p.id) ?? new Set()
      const missing = REQUIRED_TYPES.filter(t => !have.has(t)).length
      return { ...p, doc_missing: missing, doc_total: REQUIRED_TYPES.length }
    })
    return NextResponse.json({ people: list })
  }

  // 單一人員完整資料
  const { data: person } = await admin.from('agent_hr_candidates').select('*').eq('id', id).eq('user_id', ownerId).single()
  if (!person) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const [{ data: docs }, { data: checklist }, { data: contracts }] = await Promise.all([
    admin.from('hr_candidate_documents').select('id, doc_type, label, file_name, storage_path, uploaded_at').eq('candidate_id', id).eq('owner_id', ownerId),
    admin.from('hr_candidate_checklist').select('doc_key, original_received, copy_received, note').eq('candidate_id', id).eq('owner_id', ownerId),
    admin.from('hr_contracts').select('id, contract_no, sign_date, start_date, end_date, file_name, storage_path, note').eq('candidate_id', id).eq('owner_id', ownerId).order('sign_date', { ascending: false }),
  ])

  // 文件簽章 URL
  const docList = await Promise.all((docs ?? []).map(async d => {
    let url = ''
    if (d.storage_path) { const { data: sg } = await admin.storage.from(APPLY_BUCKET).createSignedUrl(d.storage_path, 3600); url = sg?.signedUrl ?? '' }
    return { ...d, url }
  }))
  const contractList = await Promise.all((contracts ?? []).map(async c => {
    let url = ''
    if (c.storage_path) { const { data: sg } = await admin.storage.from(APPLY_BUCKET).createSignedUrl(c.storage_path, 3600); url = sg?.signedUrl ?? '' }
    return { ...c, url }
  }))

  // 僱用／薪資／評估
  let employee = null, payroll: unknown[] = [], evaluations: unknown[] = []
  if (person.hired_employee_id) {
    const [{ data: emp }, { data: pay }, { data: ev }] = await Promise.all([
      admin.from('hr_employees').select('id, base_salary, hourly_rate, employment_type, insurance_required, insurance_status, insurance_salary, attendance_no, bank_name, bank_account, department, position').eq('id', person.hired_employee_id).eq('owner_id', ownerId).single(),
      admin.from('hr_payroll').select('year, month, base_salary, allowances, deductions, bonus, net_pay, status').eq('employee_id', person.hired_employee_id).eq('owner_id', ownerId).order('year', { ascending: false }).order('month', { ascending: false }).limit(12),
      admin.from('hr_evaluations').select('year, month, rating, bonus, reward_total, penalty_total').eq('employee_id', person.hired_employee_id).eq('owner_id', ownerId).order('year', { ascending: false }).order('month', { ascending: false }).limit(12),
    ])
    employee = emp; payroll = pay ?? []; evaluations = ev ?? []
  }

  return NextResponse.json({ person, documents: docList, checklist: checklist ?? [], contracts: contractList, employee, payroll, evaluations, catalog: DOC_CATALOG })
}

// 更新人員基本資料。body: { id, ...fields }
export async function PATCH(req: NextRequest) {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const f of PERSON_FIELDS) if (b[f] !== undefined) upd[f] = b[f] === null ? null : s(b[f])
  const { error } = await ctx.admin.from('agent_hr_candidates').update(upd).eq('id', id).eq('user_id', ctx.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// 刪除應徵者/人員名單。body: { id }
export async function DELETE(req: NextRequest) {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const { admin, ownerId } = ctx
  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // 1. 清理 Storage 檔案（如有上傳的履歷、證件、合同）
  const [{ data: docs }, { data: contracts }] = await Promise.all([
    admin.from('hr_candidate_documents').select('storage_path').eq('candidate_id', id).eq('owner_id', ownerId),
    admin.from('hr_contracts').select('storage_path').eq('candidate_id', id).eq('owner_id', ownerId),
  ])
  const paths = [
    ...(docs ?? []).map(d => d.storage_path).filter(Boolean),
    ...(contracts ?? []).map(c => c.storage_path).filter(Boolean),
  ]
  if (paths.length > 0) {
    await admin.storage.from(APPLY_BUCKET).remove(paths).catch(() => {})
  }

  // 2. 刪除應徵者/人員主表記錄（關聯的 documents, checklist, contracts 會因 DB on delete cascade 自動刪除）
  const { error } = await admin.from('agent_hr_candidates').delete().eq('id', id).eq('user_id', ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

