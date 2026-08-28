import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { readXlsx, type Cell } from '@/lib/inv/xlsxRead'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const num = (v: Cell): number => {
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').replace(/[,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const txt = (v: Cell) => String(v ?? '').trim()

// 匯入標準價 GIÁ XUẤT CHUẨN（.xlsx）。欄位：Mã, TÊN HÀNG, ĐVT, Đơn giá xuất CH, Đơn giá nhập
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: '缺少檔案' }, { status: 400 })

  let wb: ReturnType<typeof readXlsx>
  try { wb = readXlsx(Buffer.from(await file.arrayBuffer())) }
  catch (e) { return NextResponse.json({ error: `讀取失敗：${e instanceof Error ? e.message : e}` }, { status: 400 }) }

  const rows = wb.sheet(wb.sheetNames[0])
  const hi = rows.findIndex(r => r.some(c => /Đơn giá xuất/i.test(txt(c))))
  const header = hi >= 0 ? rows[hi] : rows[0] ?? []
  const exportCol = header.findIndex(c => /Đơn giá xuất/i.test(txt(c)))
  const purchaseCol = header.findIndex(c => /Đơn giá nhập/i.test(txt(c)))
  const ec = exportCol >= 0 ? exportCol : 3
  const pc = purchaseCol >= 0 ? purchaseCol : 4
  const start = hi >= 0 ? hi + 1 : 1

  const recs: Record<string, unknown>[] = []
  const seen = new Set<string>()
  for (let i = start; i < rows.length; i++) {
    const r = rows[i]
    const code = txt(r[0])
    const name = txt(r[1])
    if (!code || seen.has(code)) continue
    if (/^(mã|tổng|tong)/i.test(code)) continue
    seen.add(code)
    recs.push({
      owner_id: user.id, material_code: code, material_name: name, unit: txt(r[2]),
      export_price: num(r[ec]), purchase_price: num(r[pc]), updated_at: new Date().toISOString(),
    })
  }
  if (recs.length === 0) return NextResponse.json({ error: '未讀到標準價資料' }, { status: 400 })

  const { error } = await supabase.from('inv_material_prices')
    .upsert(recs, { onConflict: 'owner_id,material_code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: recs.length })
}
