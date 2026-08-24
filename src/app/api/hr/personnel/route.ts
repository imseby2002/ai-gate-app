import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DOC_CATALOG, APPLY_BUCKET } from '@/lib/hr/apply'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

const s = (v: unknown) => String(v ?? '').trim()
// 必備文件＝目錄中除「其他」外皆須備齊
const REQUIRED_TYPES = DOC_CATALOG.filter(d => d.type !== 'other').map(d => d.type)

// 人員可編輯的基本資料欄位
const PERSON_FIELDS = ['name', 'gender', 'native_place', 'birthday', 'id_number', 'education', 'email', 'company_email', 'zalo_user_id', 'payroll_no', 'position', 'store', 'staff_category', 'address', 'phone'] as const

export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = s(new URL(req.url).searchParams.get('id'))

  if (!id) {
    // 清單：人員 ＋ 文件齊全度
    const { data: people } = await supabase.from('agent_hr_candidates')
      .select('id, name, position, store, staff_category, stage, hired_employee_id, apply_token')
      .eq('user_id', user.id).order('created_at', { ascending: false })
    const ids = (people ?? []).map(p => p.id)
    const { data: docs } = ids.length
      ? await supabase.from('hr_candidate_documents').select('candidate_id, doc_type').in('candidate_id', ids)
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
  const { data: person } = await supabase.from('agent_hr_candidates').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!person) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const admin = createAdminClient()
  const [{ data: docs }, { data: checklist }, { data: contracts }] = await Promise.all([
    supabase.from('hr_candidate_documents').select('id, doc_type, label, file_name, storage_path, uploaded_at').eq('candidate_id', id).eq('owner_id', user.id),
    supabase.from('hr_candidate_checklist').select('doc_key, original_received, copy_received, note').eq('candidate_id', id).eq('owner_id', user.id),
    supabase.from('hr_contracts').select('id, contract_no, sign_date, start_date, end_date, file_name, storage_path, note').eq('candidate_id', id).eq('owner_id', user.id).order('sign_date', { ascending: false }),
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
      supabase.from('hr_employees').select('id, base_salary, hourly_rate, employment_type, insurance_required, insurance_status, insurance_salary, attendance_no, bank_name, bank_account, department, position').eq('id', person.hired_employee_id).eq('owner_id', user.id).single(),
      supabase.from('hr_payroll').select('year, month, base_salary, allowances, deductions, bonus, net_pay, status').eq('employee_id', person.hired_employee_id).eq('owner_id', user.id).order('year', { ascending: false }).order('month', { ascending: false }).limit(12),
      supabase.from('hr_evaluations').select('year, month, rating, bonus, reward_total, penalty_total').eq('employee_id', person.hired_employee_id).eq('owner_id', user.id).order('year', { ascending: false }).order('month', { ascending: false }).limit(12),
    ])
    employee = emp; payroll = pay ?? []; evaluations = ev ?? []
  }

  return NextResponse.json({ person, documents: docList, checklist: checklist ?? [], contracts: contractList, employee, payroll, evaluations, catalog: DOC_CATALOG })
}

// 更新人員基本資料。body: { id, ...fields }
export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const f of PERSON_FIELDS) if (b[f] !== undefined) upd[f] = b[f] === null ? null : s(b[f])
  const { error } = await supabase.from('agent_hr_candidates').update(upd).eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
