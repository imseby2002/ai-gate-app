import { NextRequest, NextResponse } from 'next/server'
import { profileOpen } from '@/lib/hr/profile'
import { ATTENDANCE_ERR, attendanceTaken, cleanAttendanceNo, validAttendanceNo } from '@/lib/hr/attendance'
import { getUnitContext } from '@/lib/auth/unit-access'
import { companySlugForOwner } from '@/lib/company/fromHost'
import { adoptProfileAccess, cleanStores, cleanUnits, checkProfileLink, syncProfileFromEmployee } from '@/lib/hr/account-sync'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin , status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin , status: ctx.status }
}

export async function GET() {
  const { user, supabase , status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const { data, error } = await supabase
    .from('hr_employees')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // 員工專區網址前綴（公司子網域），前端組合 /e/<打卡編號>
  const slug = await companySlugForOwner(user.id)
  // 履歷修改狀態（人員資料掛在錄用時的應徵者資料上）
  const { data: cands } = await supabase.from('agent_hr_candidates')
    .select('hired_employee_id, identity_locked, profile_edit_until, resume_updated_at')
    .eq('user_id', user.id).not('hired_employee_id', 'is', null)
  const pe = new Map((cands ?? []).map(c => [c.hired_employee_id as string, c]))
  const employees = (data ?? []).map(e => {
    const c = pe.get(e.id)
    const open = profileOpen(c ?? {})
    return { ...e, profile_edit: { open, until: open ? c?.profile_edit_until ?? null : null, updated_at: c?.resume_updated_at ?? null } }
  })
  return NextResponse.json({ employees, portal_base: slug ? `https://${slug}.im-tourist.com` : null })
}

export async function POST(req: NextRequest) {
  const { user, supabase , status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const body = await req.json()
  const {
    name, email, phone, department, position, employment_type, hire_date, base_salary,
    bank_account, id_number, notes, status,
    staff_category, insurance_required, insurance_status, insurance_number, insurance_salary,
    hourly_rate, attendance_no, payroll_code, store, bank_name,
    birthday, units, store_locked, profile_id, managed_stores,
  } = body
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  let access: { units: string[]; store?: string; store_locked?: boolean; managed_stores?: string[] } = { units: cleanUnits(units) }
  if (profile_id) {
    const linkErr = await checkProfileLink(supabase, user.id, profile_id)
    if (linkErr) return NextResponse.json({ error: linkErr }, { status: 400 })
    access = await adoptProfileAccess(supabase, profile_id, access.units)
  }

  const attNo = cleanAttendanceNo(attendance_no)
  if (!validAttendanceNo(attNo)) return NextResponse.json({ error: ATTENDANCE_ERR }, { status: 400 })
  const dupNew = await attendanceTaken(supabase, user.id, attNo)
  if (dupNew) return NextResponse.json({ error: `打卡工號 ${attNo} 已被 ${dupNew.name} 使用` }, { status: 400 })
  const { data, error } = await supabase
    .from('hr_employees')
    .insert({
      owner_id: user.id, name, email: email ?? '', phone: phone ?? '',
      department: department ?? '', position: position ?? '',
      employment_type: employment_type ?? 'full-time',
      hire_date: hire_date ?? null,
      base_salary: base_salary ?? 0,
      bank_account: bank_account ?? '', id_number: id_number ?? '',
      notes: notes ?? '', status: status ?? 'active',
      staff_category: staff_category ?? 'fulltime',
      insurance_required: insurance_required ?? false,
      insurance_status: insurance_status ?? 'none',
      insurance_number: insurance_number ?? '',
      insurance_salary: insurance_salary ?? 0,
      hourly_rate: hourly_rate ?? 0,
      attendance_no: cleanAttendanceNo(attendance_no),
      payroll_code: payroll_code ?? '',
      store: access.store ?? (String(store ?? '').trim() || cleanStores(managed_stores)[0] || ''),
      bank_name: bank_name ?? '',
      birthday: birthday || null,
      units: access.units,
      store_locked: access.store_locked ?? store_locked !== false,
      managed_stores: access.managed_stores ?? cleanStores(managed_stores),
      profile_id: profile_id || null,
    })
    .select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await syncProfileFromEmployee(supabase, data)
  return NextResponse.json({ employee: data })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase , status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const body = await req.json()
  const { id, owner_id: _owner, created_at: _created, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  // 只讀／衍生欄位不寫回（列表 API 附帶的 profile_edit、舊工號紀錄由下方計算）
  delete updates.profile_edit
  delete updates.prev_attendance_nos
  delete updates.updated_at
  if (updates.units !== undefined) updates.units = cleanUnits(updates.units)
  // 打卡工號：只能數字、不可重複；變更時保留舊號，舊的員工專區連結會導向新號
  let attendanceChanged = false
  if (updates.attendance_no !== undefined) {
    const no = cleanAttendanceNo(updates.attendance_no)
    if (!validAttendanceNo(no)) return NextResponse.json({ error: ATTENDANCE_ERR }, { status: 400 })
    const dup = await attendanceTaken(supabase, user.id, no, id)
    if (dup) return NextResponse.json({ error: `打卡工號 ${no} 已被 ${dup.name} 使用` }, { status: 400 })
    updates.attendance_no = no
    const { data: cur } = await supabase.from('hr_employees').select('attendance_no, prev_attendance_nos').eq('id', id).eq('owner_id', user.id).single()
    const old = String(cur?.attendance_no ?? '').trim()
    if (cur && old !== no) {
      attendanceChanged = true
      const prev = new Set<string>((cur.prev_attendance_nos as string[] | null) ?? [])
      if (old) prev.add(old)
      prev.delete(no)
      updates.prev_attendance_nos = [...prev]
    }
  }
  if (updates.birthday !== undefined) updates.birthday = updates.birthday || null
  if (updates.managed_stores !== undefined) updates.managed_stores = cleanStores(updates.managed_stores)
  // 所屬門市空白但有勾管理門市：以第一家為所屬門市（排班、員工專區以所屬門市為準）
  if (updates.store !== undefined && !String(updates.store ?? '').trim() && Array.isArray(updates.managed_stores) && updates.managed_stores.length) updates.store = updates.managed_stores[0]
  if (updates.profile_id !== undefined) {
    updates.profile_id = updates.profile_id || null
    if (updates.profile_id) {
      const linkErr = await checkProfileLink(supabase, user.id, updates.profile_id, id)
      if (linkErr) return NextResponse.json({ error: linkErr }, { status: 400 })
      const { data: cur } = await supabase.from('hr_employees').select('profile_id').eq('id', id).eq('owner_id', user.id).single()
      if (cur && cur.profile_id !== updates.profile_id) {
        Object.assign(updates, await adoptProfileAccess(supabase, updates.profile_id, cleanUnits(updates.units)))
      }
    }
  }

  const { data, error } = await supabase
    .from('hr_employees')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('owner_id', user.id)
    .select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await syncProfileFromEmployee(supabase, data)
  return NextResponse.json({ employee: data, attendance_changed: attendanceChanged })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase , status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('hr_employees').delete().eq('id', id).eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
