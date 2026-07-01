import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase
    .from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

const slug = (s: string) =>
  (s || '').trim().toUpperCase().replace(/[^\wÀ-￿]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)

// POST /api/hr/pnl/import-schema
// body: {
//   mode: 'replace' | 'append',
//   lineNames: string[],            // 科目（中文）依序
//   storeNames: string[],           // 門市名依序
//   period?: string,                // 'YYYY-MM'，有帶且有 matrix 才寫值
//   matrix?: (number|null)[][],     // [lineIndex][storeIndex] 金額
// }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const mode: 'replace' | 'append' = body?.mode === 'replace' ? 'replace' : 'append'
  const lineNames: string[] = Array.isArray(body?.lineNames)
    ? body.lineNames.map((s: unknown) => String(s ?? '').trim()).filter(Boolean) : []
  const storeNames: string[] = Array.isArray(body?.storeNames)
    ? body.storeNames.map((s: unknown) => String(s ?? '').trim()).filter(Boolean) : []
  const period: string = String(body?.period ?? '')
  const matrix: (number | null)[][] = Array.isArray(body?.matrix) ? body.matrix : []

  if (lineNames.length === 0 && storeNames.length === 0)
    return NextResponse.json({ error: '沒有可建立的門市或科目' }, { status: 400 })
  if (lineNames.length > 300) return NextResponse.json({ error: '科目數量過多' }, { status: 400 })
  if (storeNames.length > 100) return NextResponse.json({ error: '門市數量過多' }, { status: 400 })

  // ── 科目 ──
  const lineCodes: string[] = []
  if (lineNames.length > 0) {
    if (mode === 'replace') {
      await supabase.from('pnl_lines').delete().eq('owner_id', user.id)
    }
    const { data: existing } = await supabase.from('pnl_lines')
      .select('sort').eq('owner_id', user.id).order('sort', { ascending: false }).limit(1)
    let sort = mode === 'replace' ? 0 : ((existing?.[0]?.sort ?? -1) + 1)
    const rows = lineNames.map((zh, i) => {
      const code = `imp_${Date.now().toString(36)}_${i}`
      lineCodes.push(code)
      return { owner_id: user.id, code, zh, vi: '', section: '', kind: 'detail', compute: null, sort: sort++ }
    })
    const { error } = await supabase.from('pnl_lines').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── 門市（依名稱去重，已存在則沿用） ──
  const { data: existStores } = await supabase.from('pnl_stores')
    .select('id, name, code, sort').eq('owner_id', user.id)
  const byName = new Map((existStores ?? []).map(s => [s.name, s]))
  const usedCodes = new Set((existStores ?? []).map(s => s.code))
  let sSort = (existStores ?? []).reduce((m, s) => Math.max(m, s.sort), -1) + 1
  const storeIds: string[] = []
  for (const name of storeNames) {
    const found = byName.get(name)
    if (found) { storeIds.push(found.id); continue }
    let code = slug(name) || `STORE_${sSort}`
    while (usedCodes.has(code)) code = `${code}_${sSort}`
    usedCodes.add(code)
    const { data, error } = await supabase.from('pnl_stores').insert({
      owner_id: user.id, code, name, name_vi: '', kind: 'store', sort: sSort++,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    storeIds.push(data.id)
  }

  // ── 值（選填） ──
  let valueCount = 0
  if (/^\d{4}-\d{2}$/.test(period) && matrix.length > 0 && lineCodes.length > 0) {
    const entries: { owner_id: string; store_id: string; period: string; line_code: string; amount: number; source: string; updated_at: string }[] = []
    for (let li = 0; li < lineNames.length; li++) {
      const rowVals = matrix[li] ?? []
      for (let si = 0; si < storeNames.length; si++) {
        const amount = Number(rowVals[si])
        if (!Number.isFinite(amount) || amount === 0) continue
        if (!lineCodes[li] || !storeIds[si]) continue
        entries.push({
          owner_id: user.id, store_id: storeIds[si], period, line_code: lineCodes[li],
          amount, source: 'import', updated_at: new Date().toISOString(),
        })
      }
    }
    if (entries.length > 0) {
      const { error } = await supabase.from('pnl_entries')
        .upsert(entries, { onConflict: 'owner_id,store_id,period,line_code' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      valueCount = entries.length
    }
  }

  return NextResponse.json({
    ok: true, lines: lineCodes.length, stores: storeNames.length, values: valueCount,
  })
}
