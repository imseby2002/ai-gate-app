import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContextAny(['audit', 'store', 'rd'])
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}
const s = (v: unknown) => String(v ?? '').trim()
const KINDS = new Set(['sop', 'ergonomics', 'hygiene', 'rules', 'other'])

// 稽核知識庫（AI 訓練資料：流程、動線、人體工學、SOP、罰則）
export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data } = await supabase.from('audit_knowledge')
    .select('id, kind, title, content, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const content = s(b.content)
  const title = s(b.title)
  if (!title || !content) return NextResponse.json({ error: '標題與內容皆為必填' }, { status: 400 })
  const kind = KINDS.has(s(b.kind)) ? s(b.kind) : 'sop'
  const { data, error } = await supabase.from('audit_knowledge')
    .insert({ owner_id: user.id, kind, title, content })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('audit_knowledge').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
