import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { readXlsx, type Cell } from '@/lib/inv/xlsxRead'

async function getAdminUser() {
  const ctx = await getUnitContextAny(['rd', 'store', 'audit'])
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const num = (v: Cell): number => {
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').replace(/[,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const txt = (v: Cell) => String(v ?? '').trim()

const normalizeCategory = (val: string): string => {
  const s = val.toLowerCase()
  if (/設備|thiết\s*bị|machine|equipment/i.test(s)) return '設備'
  if (/道具|器具|dụng\s*cụ|tool|prop/i.test(s)) return '道具'
  if (/耗材|包材|vật\s*tư|bao\s*bì|consumable|cup|straw|bag/i.test(s)) return '耗材'
  return '原料'
}

// 匯入標準價 GIÁ XUẤT CHUẨN（.xlsx）。
// 支援三層定價與品項分類：
// 1. purchase_price: 工廠進貨價 (Đơn giá nhập)
// 2. export_price: 賣給直營門市價格 (Đơn giá xuất CH，配方表使用此價格為門市成本)
// 3. dealer_price: 賣給經銷商或非直營門市價格 (Đơn giá xuất đại lý / nhượng quyền)
// 4. category: 原料 / 設備 / 道具 / 耗材
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
  const hi = rows.findIndex(r => r.some(c => /xuất|nhập|giá|đơn giá/i.test(txt(c))))
  const header = hi >= 0 ? rows[hi] : rows[0] ?? []

  // 匹配賣給直營門市價格 (export_price)
  let ec = header.findIndex(c => /xuất\s*ch|trực\s*doanh|直營|門市價/i.test(txt(c)))
  if (ec < 0) ec = header.findIndex(c => /Đơn giá xuất/i.test(txt(c)))
  if (ec < 0) ec = 3

  // 匹配工廠進貨價 (purchase_price)
  let pc = header.findIndex(c => /nhập|進價|進貨|工廠價/i.test(txt(c)))
  if (pc < 0) pc = 4

  // 匹配賣給經銷商/非直營門市價格 (dealer_price)
  const dc = header.findIndex(c => /đại\s*lý|nhượng\s*quyền|經銷|加盟|非直營|批發/i.test(txt(c)))

  // 匹配品類欄位 (category)
  const cc = header.findIndex(c => /phân\s*loại|loại\s*hàng|分類|類別|品類|category/i.test(txt(c)))

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

    const rawCategory = cc >= 0 ? txt(r[cc]) : ''

    recs.push({
      owner_id: user.id,
      material_code: code,
      material_name: name,
      unit: txt(r[2]),
      export_price: ec >= 0 ? num(r[ec]) : 0,    // 賣給直營門市價格（配方門市成本）
      purchase_price: pc >= 0 ? num(r[pc]) : 0,  // 工廠進貨價
      dealer_price: dc >= 0 ? num(r[dc]) : 0,    // 賣給經銷商或非直營門市價格
      category: rawCategory ? normalizeCategory(rawCategory) : '原料',
      updated_at: new Date().toISOString(),
    })
  }
  if (recs.length === 0) return NextResponse.json({ error: '未讀到標準價資料' }, { status: 400 })

  const { error } = await supabase.from('inv_material_prices')
    .upsert(recs, { onConflict: 'owner_id,material_code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: recs.length })
}
