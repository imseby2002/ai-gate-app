/**
 * GET  /api/marketing/cs-ai-corrections  — 列出這個商家的 AI 回答修正紀錄
 * POST /api/marketing/cs-ai-corrections  — 提交一筆修正（owner 本人，或被授權可修正 AI 的協作者）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('cs_ai_corrections')
    .select('id, situation, wrong_reply, correct_guidance, status, created_by, created_at, reverted_by, reverted_at')
    .eq('user_id', ctx.ownerId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const authorIds = [...new Set((data ?? []).flatMap(r => [r.created_by, r.reverted_by].filter(Boolean)))] as string[]
  let authors: Record<string, string> = {}
  if (authorIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', authorIds)
    authors = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name || p.email || p.id.slice(0, 8)]))
  }

  return NextResponse.json({ corrections: data ?? [], authors, canCorrectAi: ctx.canCorrectAi, isOwner: ctx.isOwner })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canCorrectAi) return NextResponse.json({ error: '你沒有修正 AI 回答的權限，請聯繫管理者授權' }, { status: 403 })

  const { situation, wrongReply, correctGuidance } = await req.json()
  if (!String(situation ?? '').trim()) return NextResponse.json({ error: '請描述客人問了什麼／當時的情境' }, { status: 400 })
  if (!String(wrongReply ?? '').trim()) return NextResponse.json({ error: '請貼上 AI 錯誤的回覆內容' }, { status: 400 })
  if (!String(correctGuidance ?? '').trim()) return NextResponse.json({ error: '請說明正確做法，AI 之後才會照著做' }, { status: 400 })

  const { data, error } = await supabase
    .from('cs_ai_corrections')
    .insert({
      user_id: ctx.ownerId,
      created_by: ctx.user.id,
      situation: String(situation).trim(),
      wrong_reply: String(wrongReply).trim(),
      correct_guidance: String(correctGuidance).trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ correction: data })
}
