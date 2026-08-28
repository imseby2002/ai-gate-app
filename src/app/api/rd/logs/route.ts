import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { summarizeChat } from '@/lib/rd/summarize'

async function getAdminUser() {
  const ctx = await getUnitContext('rd')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}
const s = (v: unknown) => String(v ?? '').trim()

// 日誌清單
export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data } = await supabase.from('rd_logs').select('id, chat_id, title, summary, updated_at').eq('owner_id', user.id).order('updated_at', { ascending: false }).limit(100)
  return NextResponse.json({ logs: data ?? [] })
}

// 立即生成／更新日誌。body: { chat_id } 指定單一；否則摘要所有有更新的對話。
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const chatId = s(b.chat_id)
  if (chatId) {
    const ok = await summarizeChat(supabase, user.id, chatId, true)
    return NextResponse.json({ ok, updated: ok ? 1 : 0 })
  }
  const { data: chats } = await supabase.from('rd_chats').select('id').eq('owner_id', user.id).order('updated_at', { ascending: false }).limit(30)
  let updated = 0
  for (const c of chats ?? []) if (await summarizeChat(supabase, user.id, c.id)) updated++
  return NextResponse.json({ ok: true, updated })
}
