import { NextRequest, NextResponse } from 'next/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { summarizeChat } from '@/lib/rd/summarize'

export const maxDuration = 60

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}
const s = (v: unknown) => String(v ?? '').trim()
type SB = Awaited<ReturnType<typeof createClient>>

const MODE_TEXT: Record<string, string> = {
  discuss: '採【討論式】：多用反問與啟發引導研發人員思考，帶著他一起討論，避免直接丟出結論或標準答案。',
  guide: '採【引導式】：一步一步帶領研發人員推進，明確指出下一步該考慮、嘗試或驗證什麼。',
}
const SUGGEST_TEXT = '在回覆本文之後，另起一行輸出分隔線 ===建議=== ，其後條列 3–5 點具體可執行的建議或直接答案（此區會顯示在「建議答案區」）。'

async function buildContext(supabase: SB, ownerId: string): Promise<string> {
  const [{ data: know }, { data: recipes }] = await Promise.all([
    supabase.from('rd_knowledge').select('kind, title, content').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(60),
    supabase.from('rd_recipes').select('name').eq('owner_id', ownerId).order('name').limit(80),
  ])
  let ctx = ''
  if (know && know.length) {
    ctx += '\n=== 公司知識庫（研發人員補充的訓練資料）===\n'
    for (const k of know) {
      const line = `【${k.kind}】${k.title}：${k.content}\n`
      if (ctx.length + line.length > 7000) break
      ctx += line
    }
  }
  if (recipes && recipes.length) ctx += `\n=== 現有配方（名稱）===\n${recipes.map(r => r.name).join('、')}\n`
  return ctx
}

// 研發討論AI。body: { chat_id?, message, mode(discuss/guide), suggest(bool) }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 400 })
  const b = await req.json().catch(() => ({}))
  const message = s(b.message)
  if (!message) return NextResponse.json({ error: '訊息必填' }, { status: 400 })
  const mode = b.mode === 'guide' ? 'guide' : 'discuss'
  const suggest = !!b.suggest

  // 對話
  let chatId = s(b.chat_id)
  if (chatId) {
    const { data } = await supabase.from('rd_chats').select('id').eq('id', chatId).eq('owner_id', user.id).single()
    if (!data) chatId = ''
  }
  if (!chatId) {
    const { data, error } = await supabase.from('rd_chats').insert({ owner_id: user.id, title: message.slice(0, 30), mode }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    chatId = data.id
  }

  await supabase.from('rd_messages').insert({ chat_id: chatId, owner_id: user.id, role: 'user', content: message })

  const { data: hist } = await supabase.from('rd_messages').select('role, content').eq('chat_id', chatId).eq('owner_id', user.id).order('created_at').limit(20)
  const context = await buildContext(supabase, user.id)
  const system = `你是資深飲料研發專家，精通茶飲與手搖飲的配方設計、原料特性、成本結構與市場趨勢。請一律以繁體中文回答。\n${MODE_TEXT[mode]}${suggest ? '\n' + SUGGEST_TEXT : ''}\n${context}`

  const messages = (hist ?? []).map(m => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: m.content }))

  let text = ''
  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await generateText({ model: anthropic('claude-sonnet-4-5'), system, maxOutputTokens: 2000, messages })
    text = res.text
  } catch (e) {
    return NextResponse.json({ error: `AI 回覆失敗：${e instanceof Error ? e.message : e}` }, { status: 500 })
  }

  let reply = text, suggestion = ''
  if (suggest) {
    const idx = text.search(/===\s*建議\s*===/)
    if (idx >= 0) { reply = text.slice(0, idx).trim(); suggestion = text.slice(idx).replace(/===\s*建議\s*===/, '').trim() }
  }

  await supabase.from('rd_messages').insert({ chat_id: chatId, owner_id: user.id, role: 'assistant', content: reply, suggestion })
  await supabase.from('rd_chats').update({ mode, updated_at: new Date().toISOString() }).eq('id', chatId).eq('owner_id', user.id)

  // 自動日誌：每累積數則對話就摘要一次（成本受限）
  const total = (hist?.length ?? 0) + 2
  if (total >= 4 && total % 4 === 0) await summarizeChat(supabase, user.id, chatId).catch(() => {})

  return NextResponse.json({ chat_id: chatId, reply, suggestion })
}
