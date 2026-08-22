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

// 上傳已填盤點表（.xlsx）→ 解析為 [{material_code, material_name, unit, counted_qty}]。
// 依標題列找欄位：碼/code、名稱/tên、單位/đvt、實盤/count。找不到則用固定欄序 0,1,2,4。
export async function POST(req: NextRequest) {
  const { user } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: '缺少檔案' }, { status: 400 })

  let wb: ReturnType<typeof readXlsx>
  try { wb = readXlsx(Buffer.from(await file.arrayBuffer())) }
  catch (e) { return NextResponse.json({ error: `讀取失敗：${e instanceof Error ? e.message : e}` }, { status: 400 }) }

  const rows = wb.sheet(wb.sheetNames[0])
  const hi = rows.findIndex(r => r.some(c => /實盤|盤點|count|đếm/i.test(txt(c))))
  const header = hi >= 0 ? rows[hi] : (rows[0] ?? [])
  const find = (re: RegExp, fallback: number) => { const i = header.findIndex(c => re.test(txt(c))); return i >= 0 ? i : fallback }
  const codeCol = find(/碼|code|mã/i, 0)
  const nameCol = find(/名稱|品名|tên|name/i, 1)
  const unitCol = find(/單位|đvt|unit/i, 2)
  const countCol = find(/實盤|盤點|count|đếm/i, 4)

  const start = hi >= 0 ? hi + 1 : 0
  const out: { material_code: string; material_name: string; unit: string; counted_qty: number }[] = []
  for (let i = start; i < rows.length; i++) {
    const r = rows[i]
    const code = txt(r[codeCol])
    if (!code || /^(原料|mã|tổng|tong)/i.test(code)) continue
    out.push({ material_code: code, material_name: txt(r[nameCol]), unit: txt(r[unitCol]), counted_qty: num(r[countCol]) })
  }
  return NextResponse.json({ items: out })
}
