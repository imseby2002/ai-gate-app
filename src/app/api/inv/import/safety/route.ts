import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readXlsx, type Cell } from '@/lib/inv/xlsxRead'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

const txt = (v: Cell) => String(v ?? '').trim()
const num = (v: Cell) => { const n = Number(String(v ?? '').replace(/[,\s]/g, '')); return Number.isFinite(n) ? n : 0 }

// 匯入安全庫存表（.xlsx）。form: file, store。欄位：原料碼,名稱,單位,安全量,滿倉量
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const store = String(form?.get('store') ?? '').trim()
  if (!(file instanceof File)) return NextResponse.json({ error: '缺少檔案' }, { status: 400 })
  if (!store) return NextResponse.json({ error: '缺少門市' }, { status: 400 })

  let wb: ReturnType<typeof readXlsx>
  try { wb = readXlsx(Buffer.from(await file.arrayBuffer())) }
  catch (e) { return NextResponse.json({ error: `讀取失敗：${e instanceof Error ? e.message : e}` }, { status: 400 }) }

  const rows = wb.sheet(wb.sheetNames[0])
  const hi = rows.findIndex(r => r.some(c => /安全/i.test(txt(c))))
  const header = hi >= 0 ? rows[hi] : (rows[0] ?? [])
  const find = (re: RegExp, fb: number) => { const i = header.findIndex(c => re.test(txt(c))); return i >= 0 ? i : fb }
  const codeCol = find(/碼|code|mã/i, 0)
  const nameCol = find(/名稱|品名|tên/i, 1)
  const unitCol = find(/單位|đvt/i, 2)
  const safeCol = find(/安全/i, 3)
  const fullCol = find(/滿倉|滿|full/i, 4)

  const start = hi >= 0 ? hi + 1 : 0
  const recs: Record<string, unknown>[] = []
  for (let i = start; i < rows.length; i++) {
    const r = rows[i]
    const code = txt(r[codeCol])
    if (!code || /^(原料|mã|tổng)/i.test(code)) continue
    recs.push({
      owner_id: user.id, store, material_code: code, material_name: txt(r[nameCol]), unit: txt(r[unitCol]),
      safety_qty: num(r[safeCol]), full_qty: num(r[fullCol]), updated_at: new Date().toISOString(),
    })
  }
  if (recs.length === 0) return NextResponse.json({ error: '未讀到任何安全庫存資料' }, { status: 400 })
  const { error } = await supabase.from('inv_safety_stock').upsert(recs, { onConflict: 'owner_id,store,material_code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: recs.length })
}
