import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { summarizeAuditChat } from '@/lib/audit/summarize'

async function getAdminUser() {
  const ctx = await getUnitContextAny(['audit', 'store', 'rd'])
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

// 稽核日誌列表
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const store = searchParams.get('store')?.trim()

  let q = supabase.from('audit_logs')
    .select('id, chat_id, store, title, summary, upto_count, created_at, updated_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (store) q = q.eq('store', store)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data ?? [] })
}

// 手動觸發某對話重新摘要為日誌
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const chatId = String(b.chat_id ?? '').trim()
  if (!chatId) return NextResponse.json({ error: 'chat_id required' }, { status: 400 })

  const updated = await summarizeAuditChat(supabase, user.id, chatId, true)
  return NextResponse.json({ updated })
}

// 刪除日誌
export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('audit_logs').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
