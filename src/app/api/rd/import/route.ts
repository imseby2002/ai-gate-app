import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readXlsx } from '@/lib/inv/xlsxRead'
import { parseCostSheet } from '@/lib/rd/costsheet'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

// 匯入配方表（.xlsx）。取「Bảng tính giá vốn SP đồ uống」sheet 解析後 upsert。
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: '缺少檔案（請上傳 .xlsx）' }, { status: 400 })

  let wb: ReturnType<typeof readXlsx>
  try { wb = readXlsx(Buffer.from(await file.arrayBuffer())) }
  catch (e) { return NextResponse.json({ error: `讀取失敗（請確認為 .xlsx）：${e instanceof Error ? e.message : e}` }, { status: 400 }) }

  const target = wb.sheetNames.find(n => /gi[áa]\s*v[ốôo]n\s*sp\s*đồ\s*u[ốôo]ng/i.test(n)) ?? wb.sheetNames.find(n => /gi[áa]\s*v[ốôo]n/i.test(n))
  if (!target) return NextResponse.json({ error: `找不到「Bảng tính giá vốn SP đồ uống」工作表（現有：${wb.sheetNames.join('、')}）` }, { status: 400 })

  const recipes = parseCostSheet(wb.sheet(target))
  if (recipes.length === 0) return NextResponse.json({ error: '未解析到任何配方' }, { status: 400 })

  let saved = 0
  for (const r of recipes) {
    const { data, error } = await supabase.from('rd_recipes').upsert({
      owner_id: user.id, name: r.name, cup_size: r.cup_size,
      total_export: r.total_export, total_purchase: r.total_purchase,
      unit_cost_export: r.unit_cost_export, unit_cost_purchase: r.unit_cost_purchase, unit_label: r.unit_label,
      source: 'import', updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,name' }).select('id').single()
    if (error || !data) continue
    await supabase.from('rd_recipe_items').delete().eq('recipe_id', data.id).eq('owner_id', user.id)
    if (r.items.length) {
      await supabase.from('rd_recipe_items').insert(r.items.map((it, i) => ({
        recipe_id: data.id, owner_id: user.id, sort: i, material_name: it.material_name, unit: it.unit, qty: it.qty,
        price_export: it.price_export, price_purchase: it.price_purchase, amount_export: it.amount_export, amount_purchase: it.amount_purchase,
      })))
    }
    saved++
  }
  return NextResponse.json({ imported: saved, sheet: target })
}
