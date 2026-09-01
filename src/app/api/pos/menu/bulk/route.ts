import { NextRequest, NextResponse } from 'next/server'
import { getPosOwner } from '@/lib/pos/auth'
import { bumpMenuRevision } from '@/lib/pos/menu'
import { DEFAULT_MODIFIER_GROUPS } from '@/lib/pos/types'

export async function POST(req: NextRequest) {
  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = (await req.json()) as { rows?: Record<string, unknown>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的菜單資料' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []

  // 1) 查詢現有分類
  const { data: existingCats } = await ctx.supabase
    .from('pos_categories')
    .select('id, name')
    .eq('owner_id', ctx.userId)

  const catMap = new Map((existingCats || []).map(c => [c.name.trim().toLowerCase(), c.id]))

  // 2) 查詢現有品項
  const { data: existingItems } = await ctx.supabase
    .from('pos_items')
    .select('id, name, category_id')
    .eq('owner_id', ctx.userId)

  const existingItemsList = existingItems || []
  let inserted = 0
  let updated = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const name = String(r.name ?? '').trim()
    const catName = String(r.category ?? r.category_name ?? '一般').trim() || '一般'

    if (!name) {
      errors.push({ line, reason: '缺少品項名稱' })
      continue
    }

    // 確保分類存在
    let catId = catMap.get(catName.toLowerCase())
    if (!catId) {
      const { data: newCat, error: catErr } = await ctx.supabase
        .from('pos_categories')
        .insert({
          owner_id: ctx.userId,
          name: catName,
          sort: 0,
        })
        .select('id, name')
        .single()
      if (catErr || !newCat) {
        errors.push({ line, reason: `建立分類「${catName}」失敗` })
        continue
      }
      catId = newCat.id
      catMap.set(catName.toLowerCase(), catId)
    }

    const price = Number(r.price ?? r.price_cents ? Number(r.price_cents) / 100 : 0) || 0
    const priceCents = Math.round(price * 100)

    const payload = {
      owner_id: ctx.userId,
      category_id: catId,
      name,
      description: String(r.description ?? '').trim(),
      price_cents: priceCents,
      barcode: String(r.barcode ?? '').trim() || null,
      modifiers: DEFAULT_MODIFIER_GROUPS,
      updated_at: new Date().toISOString(),
    }

    const match = existingItemsList.find(item => item.name.trim().toLowerCase() === name.toLowerCase() && item.category_id === catId)
    if (match) {
      const { error } = await ctx.supabase
        .from('pos_items')
        .update(payload)
        .eq('id', match.id)
      if (error) {
        errors.push({ line, reason: `更新「${name}」失敗: ${error.message}` })
      } else {
        updated++
      }
    } else {
      const { error } = await ctx.supabase
        .from('pos_items')
        .insert(payload)
      if (error) {
        errors.push({ line, reason: `新增「${name}」失敗: ${error.message}` })
      } else {
        inserted++
      }
    }
  }

  await bumpMenuRevision(ctx.supabase, ctx.userId)

  return NextResponse.json({ ok: true, inserted, updated, errors })
}
