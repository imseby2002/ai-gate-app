import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { readXlsx, type Cell } from '@/lib/inv/xlsxRead'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const txt = (v: Cell) => String(v ?? '').trim()
const num = (v: Cell) => { const n = Number(String(v ?? '').replace(/[,\s]/g, '')); return Number.isFinite(n) ? n : 0 }

// 儲存格 → YYYY-MM-DD：支援文字日期與 Excel 序列日期
function toDate(v: Cell): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') {
    const ms = Date.UTC(1899, 11, 30) + Math.round(v) * 86400000
    return new Date(ms).toISOString().slice(0, 10)
  }
  const t = txt(v).replace(/\//g, '-')
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

// 匯入進貨批次表（.xlsx）。form: file, store。欄位：原料碼,名稱,單位,進貨日期,到期日,數量
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
  const hi = rows.findIndex(r => r.some(c => /到期/i.test(txt(c))))
  const header = hi >= 0 ? rows[hi] : (rows[0] ?? [])
  const find = (re: RegExp, fb: number) => { const i = header.findIndex(c => re.test(txt(c))); return i >= 0 ? i : fb }
  const codeCol = find(/碼|code|mã/i, 0)
  const nameCol = find(/名稱|品名|tên/i, 1)
  const unitCol = find(/單位|đvt/i, 2)
  const buyCol = find(/進貨|入庫|purchase/i, 3)
  const expCol = find(/到期|效期|expiry|hết hạn/i, 4)
  const qtyCol = find(/數量|qty|số lượng/i, 5)

  const start = hi >= 0 ? hi + 1 : 0
  const recs: Record<string, unknown>[] = []
  let skipped = 0
  for (let i = start; i < rows.length; i++) {
    const r = rows[i]
    const code = txt(r[codeCol])
    if (!code || /^(原料|mã|tổng)/i.test(code)) continue
    const expiry = toDate(r[expCol])
    if (!expiry) { skipped++; continue } // 沒有到期日的列略過
    recs.push({
      owner_id: user.id, store, material_code: code, material_name: txt(r[nameCol]), unit: txt(r[unitCol]),
      purchase_date: toDate(r[buyCol]), expiry_date: expiry, qty: num(r[qtyCol]),
    })
  }
  if (recs.length === 0) return NextResponse.json({ error: '未讀到任何批次資料（每列需有到期日）' }, { status: 400 })
  const { error } = await supabase.from('inv_material_batches').insert(recs)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: recs.length, skipped })
}
