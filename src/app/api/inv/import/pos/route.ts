import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { xlsToRows } from '@/lib/hr/xls'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const num = (v: unknown): number => {
  if (typeof v === 'number') return v
  const s = String(v ?? '').replace(/[,\s]/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}
const txt = (v: unknown) => String(v ?? '').trim()

// 匯入 POS 售出（.xls）。form-data: file, store, year, month
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const store = txt(form?.get('store'))
  const year = parseInt(String(form?.get('year') ?? '')) || 0
  const month = parseInt(String(form?.get('month') ?? '')) || 0
  if (!(file instanceof File)) return NextResponse.json({ error: '缺少檔案' }, { status: 400 })
  if (!store || !year || month < 1 || month > 12) return NextResponse.json({ error: '缺少門市／年／月' }, { status: 400 })

  let rows: (string | number)[][]
  try { rows = xlsToRows(Buffer.from(await file.arrayBuffer())) }
  catch (e) { return NextResponse.json({ error: `讀取失敗：${e instanceof Error ? e.message : e}` }, { status: 400 }) }

  // 找標題列（含「Số lượng」），取杯數／金額欄位
  const found = rows.findIndex(r => r.some(c => txt(c).includes('Số lượng')))
  const hi = found < 0 ? 4 : found
  const header = rows[hi] ?? []
  const qtyCol = header.findIndex(c => txt(c).includes('Số lượng'))
  const revCol = header.findIndex(c => txt(c).includes('Thành tiền'))

  const recs: Record<string, unknown>[] = []
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]
    const code = txt(r[0])
    const name = txt(r[1])
    if (!code || /^(trang|tổng|tong)/i.test(code)) continue     // 跳過頁尾／合計
    if (!/^[0-9]/.test(code) && !name) continue
    const qty = qtyCol >= 0 ? num(r[qtyCol]) : 0
    const revenue = revCol >= 0 ? num(r[revCol]) : 0
    if (qty === 0 && revenue === 0) continue
    recs.push({ owner_id: user.id, store, year, month, product_code: code, product_name: name, qty, revenue })
  }
  if (recs.length === 0) return NextResponse.json({ error: '未讀到任何售出資料' }, { status: 400 })

  // 覆蓋該門市該月
  await supabase.from('inv_pos_sales').delete()
    .eq('owner_id', user.id).eq('store', store).eq('year', year).eq('month', month)
  const { error } = await supabase.from('inv_pos_sales').insert(recs)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ imported: recs.length, store, year, month })
}
