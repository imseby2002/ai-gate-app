/**
 * 潛在客戶名單主檔（持久化 + 去重）
 *
 * GET    /api/marketing/prospect-orgs            讀回我累積的名單
 * POST   /api/marketing/prospect-orgs            批次 upsert（去重合併），回傳合併後名單
 * PATCH  /api/marketing/prospect-orgs            更新單筆（selected / call_status）
 * DELETE /api/marketing/prospect-orgs            清空我的名單
 *
 * 去重鍵 dedup_key：有正規化電話用電話；否則用 名稱+地址 正規化。
 * 重複者更新 last_seen_at、search_count+1，保留既有 selected/call_status；新者插入。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

type IncomingOrg = {
  name: string
  phoneNormalized?: string
  address?: string
  aiCategory?: string
  [k: string]: unknown
}

function dedupKey(o: IncomingOrg): string {
  if (o.phoneNormalized && o.phoneNormalized.trim()) return 'p:' + o.phoneNormalized.trim()
  const basis = `${(o.name ?? '').trim().toLowerCase()}|${(o.address ?? '').trim().toLowerCase()}`
  return 'n:' + createHash('sha1').update(basis).digest('hex').slice(0, 16)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('prospect_orgs')
    .select('*')
    .eq('user_id', user.id)
    .order('last_seen_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orgs: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const incoming: IncomingOrg[] = Array.isArray(body?.orgs) ? body.orgs : []
  if (incoming.length === 0) return NextResponse.json({ orgs: [], added: 0, duplicated: 0 })

  // 以 dedup_key 收斂本批內部重複
  const byKey = new Map<string, IncomingOrg>()
  for (const o of incoming) {
    if (!o?.name) continue
    byKey.set(dedupKey(o), o)
  }
  const keys = [...byKey.keys()]

  // 查既有
  const { data: existing } = await supabase
    .from('prospect_orgs')
    .select('id, dedup_key, search_count')
    .eq('user_id', user.id)
    .in('dedup_key', keys)
  const existingMap = new Map((existing ?? []).map((e) => [e.dedup_key, e]))

  const now = new Date().toISOString()
  let added = 0, duplicated = 0

  for (const [key, o] of byKey) {
    const prior = existingMap.get(key)
    const row = {
      user_id: user.id,
      dedup_key: key,
      name: o.name,
      phone_normalized: o.phoneNormalized ?? null,
      address: o.address ?? null,
      ai_category: o.aiCategory ?? null,
      raw: o as Record<string, unknown>,
      last_seen_at: now,
    }
    if (prior) {
      duplicated++
      // 保留 selected/call_status，只更新出現次數與最近時間、刷新原始資料
      await supabase.from('prospect_orgs')
        .update({ ...row, search_count: (prior.search_count ?? 1) + 1 })
        .eq('id', prior.id)
    } else {
      added++
      await supabase.from('prospect_orgs').insert({ ...row, first_seen_at: now })
    }
  }

  // 回傳合併後完整名單
  const { data: merged } = await supabase
    .from('prospect_orgs')
    .select('*')
    .eq('user_id', user.id)
    .order('last_seen_at', { ascending: false })

  return NextResponse.json({ orgs: merged ?? [], added, duplicated })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, selected, call_status } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (typeof selected === 'boolean') patch.selected = selected
  if (typeof call_status === 'string') {
    patch.call_status = call_status
    if (call_status === 'called') patch.called_at = new Date().toISOString()
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('prospect_orgs')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE ?id=<uuid> 刪單筆；無 id 清空全部
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  let q = supabase.from('prospect_orgs').delete().eq('user_id', user.id)
  if (id) q = q.eq('id', id)

  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
