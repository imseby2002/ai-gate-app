import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { xlsToRows, type XlsCell } from '@/lib/hr/xls'

export const maxDuration = 60

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

const num = (v: XlsCell | undefined) => (typeof v === 'number' ? v : parseFloat(String(v ?? '')) || 0)
const str = (v: XlsCell | undefined) => String(v ?? '').trim()

// 考勤機 .xls 匯入：彙總每人月時數，upsert 保留既有手動補登
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: '缺少檔案' }, { status: 400 })
  // 上傳時指定門市（每個檔案一個門市）；未指定才退回用檔案「部门」欄
  const storeOverride = str(form.get('store') as XlsCell | undefined)

  let rows: XlsCell[][]
  try {
    rows = xlsToRows(Buffer.from(await file.arrayBuffer()))
  } catch (e) {
    return NextResponse.json({ error: `無法讀取 .xls：${String(e)}` }, { status: 400 })
  }
  if (rows.length < 2) return NextResponse.json({ error: '檔案沒有資料列' }, { status: 400 })

  // 以標題文字定位欄位（比固定欄位穩健）
  const header = rows[0].map(h => str(h))
  const idx = (name: string) => header.indexOf(name)
  const cPeriod = idx('考勤期间'), cName = idx('姓名'), cNo = idx('工号')
  const cDept = idx('部门'), cType = idx('考勤类型'), cHours = idx('实际工作小时数')
  if (cName < 0 || cNo < 0 || cHours < 0) {
    return NextResponse.json({ error: '欄位標題不符（需要 姓名／工号／实际工作小时数），請確認是考勤機匯出檔' }, { status: 400 })
  }

  // 期別（202607 → year/month）取第一筆資料列
  const periodRaw = str(rows[1][cPeriod] ?? '')
  const year = parseInt(periodRaw.slice(0, 4)) || new Date().getFullYear()
  const month = parseInt(periodRaw.slice(4, 6)) || (new Date().getMonth() + 1)

  // 彙總 by (store, 工号)
  type Agg = { store: string; attendance_no: string; name: string; att_type: string; machine_hours: number; work_days: number }
  const map = new Map<string, Agg>()
  for (let r = 1; r < rows.length; r++) {
    const no = str(rows[r][cNo]); const name = str(rows[r][cName])
    if (!no && !name) continue
    const store = storeOverride || (cDept >= 0 ? str(rows[r][cDept]) : '')
    const key = store + '|' + no
    let a = map.get(key)
    if (!a) { a = { store, attendance_no: no, name, att_type: cType >= 0 ? str(rows[r][cType]) : '', machine_hours: 0, work_days: 0 }; map.set(key, a) }
    const h = num(rows[r][cHours])
    a.machine_hours += h
    if (h > 0) a.work_days += 1
    if (!a.name && name) a.name = name
  }
  const aggs = Array.from(map.values())
  if (!aggs.length) return NextResponse.json({ error: '沒有可彙總的資料' }, { status: 400 })

  // 保留既有手動補登
  const { data: existing } = await supabase
    .from('hr_attendance').select('store, attendance_no, adjust_hours, adjust_note')
    .eq('owner_id', user.id).eq('year', year).eq('month', month)
  const keep = new Map<string, { adjust_hours: number; adjust_note: string }>()
  for (const e of (existing ?? []) as { store: string; attendance_no: string; adjust_hours: number; adjust_note: string }[]) {
    keep.set(e.store + '|' + e.attendance_no, { adjust_hours: Number(e.adjust_hours) || 0, adjust_note: e.adjust_note ?? '' })
  }

  const now = new Date().toISOString()
  const upserts = aggs.map(a => {
    const k = keep.get(a.store + '|' + a.attendance_no)
    return {
      owner_id: user.id, store: a.store, year, month,
      attendance_no: a.attendance_no, name: a.name, att_type: a.att_type,
      machine_hours: Math.round(a.machine_hours * 100) / 100, work_days: a.work_days,
      adjust_hours: k?.adjust_hours ?? 0, adjust_note: k?.adjust_note ?? '', updated_at: now,
    }
  })

  const { data, error } = await supabase
    .from('hr_attendance')
    .upsert(upserts, { onConflict: 'owner_id,year,month,store,attendance_no' })
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const stores = Array.from(new Set(aggs.map(a => a.store).filter(Boolean)))
  return NextResponse.json({ imported: data?.length ?? 0, year, month, stores })
}
