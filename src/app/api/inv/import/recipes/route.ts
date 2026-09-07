import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { readXlsx, type Cell } from '@/lib/inv/xlsxRead'
import { xlsToRows } from '@/lib/hr/xls'

async function getAdminUser() {
  const ctx = await getUnitContextAny(['rd', 'store', 'audit'])
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

// 匯入配方（.xlsx / .xls）
// 欄位匹配：配方名稱/成品名稱 | 備註 | 原料代碼/碼 | 原料名稱 | 每杯用量/用量
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: '缺少檔案' }, { status: 400 })

  const filename = file.name.toLowerCase()
  let rows: Cell[][] = []

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    if (filename.endsWith('.xls')) {
      rows = xlsToRows(buf)
    } else {
      const wb = readXlsx(buf)
      rows = wb.sheet(wb.sheetNames[0])
    }
  } catch (e) {
    return NextResponse.json({ error: `讀取檔案失敗：${e instanceof Error ? e.message : e}` }, { status: 400 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: '檔案中無資料' }, { status: 400 })
  }

  // 尋找標題列
  const headerIdx = rows.findIndex(r =>
    r.some(c => /配方|成品|原料|用量|recipe|material/i.test(txt(c)))
  )
  const hi = headerIdx >= 0 ? headerIdx : 0
  const header = rows[hi] ?? []

  // 匹配欄位索引
  const recipeCol = header.findIndex(c => /配方|成品|recipe/i.test(txt(c)))
  const noteCol = header.findIndex(c => /備註|說明|note/i.test(txt(c)))
  const matCodeCol = header.findIndex(c => /原料代碼|原料碼|代碼|material_?code|code/i.test(txt(c)))
  const matNameCol = header.findIndex(c => /原料名稱|原料|material_?name|name/i.test(txt(c)))
  const qtyCol = header.findIndex(c => /每杯用量|用量|數量|qty|quantity/i.test(txt(c)))

  const rc = recipeCol >= 0 ? recipeCol : 0
  const nc = noteCol >= 0 ? noteCol : 1
  const mc = matCodeCol >= 0 ? matCodeCol : (rc === 0 && nc === 1 ? 2 : 1)
  const mn = matNameCol >= 0 ? matNameCol : (mc + 1)
  const qc = qtyCol >= 0 ? qtyCol : (mn + 1)

  const startRow = hi >= 0 && headerIdx >= 0 ? hi + 1 : 0

  // 分組配方
  interface RecipeGroup {
    name: string
    note: string
    items: Array<{ material_code: string; material_name: string; qty_per_cup: number }>
  }
  const recipeGroups = new Map<string, RecipeGroup>()
  let currentRecipeName = ''
  let currentNote = ''

  for (let i = startRow; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.length === 0) continue

    const nameVal = txt(r[rc])
    const noteVal = nc >= 0 && nc < r.length ? txt(r[nc]) : ''
    const matCode = mc < r.length ? txt(r[mc]) : ''
    const matName = mn < r.length ? txt(r[mn]) : ''
    const qty = qc < r.length ? num(r[qc]) : 0

    // 如果這一列有新的配方名稱，更新當前配方名稱
    if (nameVal) {
      currentRecipeName = nameVal
      currentNote = noteVal
    }

    if (!currentRecipeName) continue
    // 如果這列沒有原料代碼或名稱，跳過
    if (!matCode && !matName) continue

    if (!recipeGroups.has(currentRecipeName)) {
      recipeGroups.set(currentRecipeName, {
        name: currentRecipeName,
        note: currentNote,
        items: [],
      })
    }

    const group = recipeGroups.get(currentRecipeName)!
    group.items.push({
      material_code: matCode || matName,
      material_name: matName || matCode,
      qty_per_cup: qty,
    })
  }

  if (recipeGroups.size === 0) {
    return NextResponse.json({ error: '未解析到有效的配方資料，請檢查檔案欄位格式' }, { status: 400 })
  }

  // 取得該 owner 已存在的配方
  const { data: existingRecipes } = await supabase
    .from('inv_recipes')
    .select('id, name')
    .eq('owner_id', user.id)

  const existingMap = new Map<string, string>()
  for (const er of existingRecipes ?? []) {
    existingMap.set(er.name, er.id)
  }

  let importedCount = 0

  for (const [recipeName, group] of recipeGroups.entries()) {
    let recipeId = existingMap.get(recipeName)

    if (recipeId) {
      // 更新配方 note
      await supabase
        .from('inv_recipes')
        .update({ note: group.note })
        .eq('id', recipeId)
        .eq('owner_id', user.id)

      // 刪除舊原料
      await supabase
        .from('inv_recipe_items')
        .delete()
        .eq('recipe_id', recipeId)
        .eq('owner_id', user.id)
    } else {
      // 建立新配方
      const { data: newRecipe, error: createErr } = await supabase
        .from('inv_recipes')
        .insert({ owner_id: user.id, name: recipeName, note: group.note })
        .select('id')
        .single()

      if (createErr || !newRecipe) continue
      recipeId = newRecipe.id
    }

    // 插入新原料項目
    if (group.items.length > 0) {
      const itemsToInsert = group.items.map(item => ({
        recipe_id: recipeId,
        owner_id: user.id,
        material_code: item.material_code,
        material_name: item.material_name,
        qty_per_cup: item.qty_per_cup,
      }))

      await supabase.from('inv_recipe_items').insert(itemsToInsert)
    }

    importedCount++
  }

  return NextResponse.json({
    imported: importedCount,
    totalRecipes: recipeGroups.size,
    recipeNames: Array.from(recipeGroups.keys()),
  })
}
