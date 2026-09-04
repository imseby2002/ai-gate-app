import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { readXlsx, type Cell } from '@/lib/inv/xlsxRead'

async function getAdminUser() {
  const ctx = await getUnitContextAny(['store', 'audit'])
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const num = (v: Cell): number => {
  if (typeof v === 'number') return v
  const s = String(v ?? '').replace(/[,\s]/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}
const txt = (v: unknown) => String(v ?? '').trim()

// 進銷存 vendor 匯出固定欄位（BÁO CÁO XUẤT NHẬP TỒN）
// 0 Mã,1 Tên,3 ĐVT,4 期初數量,5 期初金額,9 Tổng nhập,10 Tổng tiền nhập,
// 14 Xuất bán POS,15 Tổng xuất,16 Tổng tiền xuất,17 期末數量,18 期末金額
function parseSheetRows(rows: Cell[][], ownerId: string, store: string, year: number, month: number) {
  const hi = rows.findIndex(r => r.some(c => txt(c).includes('Tổng nhập')))
  if (hi < 0) return []
  // 「lượng dùng tháng」＝當月原料使用量（排除「tổng lượng dùng」）；預設第 19 欄
  const header = rows[hi] ?? []
  const usageCol = header.findIndex(c => /^lượng dùng/i.test(txt(c)))
  const uc = usageCol >= 0 ? usageCol : 19
  const recs: Record<string, unknown>[] = []
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]
    const code = txt(r[0])
    const name = txt(r[1])
    if (!code || !name) continue
    if (/^(tổng|tong|báo cáo|kho hàng)/i.test(code)) continue
    recs.push({
      owner_id: ownerId, store, year, month,
      material_code: code, material_name: name, unit: txt(r[3]),
      open_qty: num(r[4]), open_value: num(r[5]),
      in_total: num(r[9]), in_value: num(r[10]),
      out_pos: num(r[14]), out_total: num(r[15]), out_value: num(r[16]),
      close_qty: num(r[17]), close_value: num(r[18]),
      usage_month: num(r[uc]),
    })
  }
  return recs
}

// 匯入進銷存（.xlsx，多門市＝多工作表）。form-data: file, year, month, [store 指定單一工作表對應門市名]
export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const year = parseInt(String(form?.get('year') ?? '')) || 0
  const month = parseInt(String(form?.get('month') ?? '')) || 0
  const onlyStore = txt(form?.get('store'))
  if (!(file instanceof File)) return NextResponse.json({ error: '缺少檔案' }, { status: 400 })
  if (!year || month < 1 || month > 12) return NextResponse.json({ error: '缺少年／月' }, { status: 400 })

  let wb: ReturnType<typeof readXlsx>
  try { wb = readXlsx(Buffer.from(await file.arrayBuffer())) }
  catch (e) { return NextResponse.json({ error: `讀取失敗：${e instanceof Error ? e.message : e}` }, { status: 400 }) }

  const sheets = onlyStore ? wb.sheetNames.filter(s => s === onlyStore) : wb.sheetNames
  const perStore: { store: string; count: number }[] = []
  for (const sheet of sheets) {
    const recs = parseSheetRows(wb.sheet(sheet), user.id, sheet, year, month)
    if (recs.length === 0) continue
    await supabase.from('inv_movements').delete()
      .eq('owner_id', user.id).eq('store', sheet).eq('year', year).eq('month', month)
    const { error } = await supabase.from('inv_movements').insert(recs)
    if (error) return NextResponse.json({ error: `${sheet}：${error.message}` }, { status: 500 })
    perStore.push({ store: sheet, count: recs.length })
  }
  if (perStore.length === 0) return NextResponse.json({ error: '未讀到任何進銷存資料' }, { status: 400 })

  return NextResponse.json({ stores: perStore, year, month })
}
