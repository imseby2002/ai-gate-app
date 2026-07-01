import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PNL_LINES } from '@/app/(standalone)/finance/pnl-schema'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase
    .from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

type LineRow = {
  code: string; zh: string; vi: string; section: string
  kind: string; compute: unknown; sort: number
}

function sanitize(v: unknown, ownerId: string): LineRow[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: LineRow[] = []
  v.forEach((l, i) => {
    const code = String((l as LineRow)?.code ?? '').trim()
    if (!code || seen.has(code)) return
    seen.add(code)
    const kind = ['revenue', 'detail', 'subtotal', 'compare'].includes((l as LineRow)?.kind)
      ? (l as LineRow).kind : 'detail'
    out.push({
      code,
      zh: String((l as LineRow)?.zh ?? '').slice(0, 60),
      vi: String((l as LineRow)?.vi ?? '').slice(0, 60),
      section: String((l as LineRow)?.section ?? '').slice(0, 40),
      kind,
      compute: kind === 'subtotal' ? ((l as LineRow)?.compute ?? null) : null,
      sort: Number.isFinite((l as LineRow)?.sort) ? (l as LineRow).sort : i,
    })
  })
  void ownerId
  return out
}

// GET /api/hr/pnl/schema — 回傳該使用者科目樹；首次為空則種入預設並建一個「A門市」
export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let { data: lines } = await supabase.from('pnl_lines')
    .select('code, zh, vi, section, kind, compute, sort, archived')
    .eq('owner_id', user.id).order('sort', { ascending: true })

  if (!lines || lines.length === 0) {
    const seed = PNL_LINES.map((l, i) => ({
      owner_id: user.id, code: l.code, zh: l.zh, vi: l.vi,
      section: l.section, kind: l.kind, compute: l.compute ?? null, sort: i,
    }))
    const { error } = await supabase.from('pnl_lines').insert(seed)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    lines = seed.map(s => ({ ...s, archived: false }))

    // 首次也建一個預設門市（僅在完全沒有門市時）
    const { count } = await supabase.from('pnl_stores')
      .select('id', { count: 'exact', head: true }).eq('owner_id', user.id)
    if ((count ?? 0) === 0) {
      await supabase.from('pnl_stores').insert({
        owner_id: user.id, code: 'STORE_A', name: 'A門市', name_vi: '', kind: 'store', sort: 0,
      })
    }
  }

  return NextResponse.json({ lines })
}

// PUT /api/hr/pnl/schema — 覆寫整份科目樹：body { lines: [...] }
export async function PUT(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const rows = sanitize(body?.lines, user.id)
  if (rows.length === 0) return NextResponse.json({ error: '至少需保留一個科目' }, { status: 400 })
  if (rows.length > 300) return NextResponse.json({ error: '科目數量過多' }, { status: 400 })

  // 刪除已移除的科目
  const { data: existing } = await supabase.from('pnl_lines')
    .select('code').eq('owner_id', user.id)
  const keep = new Set(rows.map(r => r.code))
  const toDelete = (existing ?? []).map(e => e.code).filter(c => !keep.has(c))
  if (toDelete.length > 0) {
    const { error } = await supabase.from('pnl_lines')
      .delete().eq('owner_id', user.id).in('code', toDelete)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const upsertRows = rows.map(r => ({
    owner_id: user.id, code: r.code, zh: r.zh, vi: r.vi, section: r.section,
    kind: r.kind, compute: r.compute, sort: r.sort, archived: false,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('pnl_lines')
    .upsert(upsertRows, { onConflict: 'owner_id,code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, count: upsertRows.length })
}
