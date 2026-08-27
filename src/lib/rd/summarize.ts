// 研發討論AI 自動日誌：把一段對話用 AI 摘要成日誌條目。
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import type { createClient } from '@/lib/supabase/server'

type SB = Awaited<ReturnType<typeof createClient>>

// 摘要某對話並 upsert 到 rd_logs。回傳是否有更新。
export async function summarizeChat(supabase: SB, ownerId: string, chatId: string, force = false): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false
  const { data: chat } = await supabase.from('rd_chats').select('title').eq('id', chatId).eq('owner_id', ownerId).single()
  const { data: msgs } = await supabase.from('rd_messages').select('role, content').eq('chat_id', chatId).eq('owner_id', ownerId).order('created_at')
  if (!msgs || msgs.length === 0) return false

  const { data: existing } = await supabase.from('rd_logs').select('upto_count').eq('chat_id', chatId).single()
  if (!force && existing && existing.upto_count >= msgs.length) return false

  const transcript = msgs.map(m => `${m.role === 'assistant' ? 'AI' : '研發人員'}：${m.content}`).join('\n')
  const system = '你是研發日誌助理。請把以下研發人員與研發討論AI 的對話，摘要成一則精簡日誌（繁體中文）。' +
    '格式：\n・主題：一句話\n・討論重點：條列 2–5 點\n・結論／下一步：條列 1–3 點（若尚無結論則寫「討論中」）。只輸出日誌內容。'
  let summary = ''
  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await generateText({ model: anthropic('claude-sonnet-4-5'), system, maxOutputTokens: 800, messages: [{ role: 'user', content: transcript.slice(0, 12000) }] })
    summary = res.text.trim()
  } catch { return false }
  if (!summary) return false

  await supabase.from('rd_logs').upsert({
    owner_id: ownerId, chat_id: chatId, title: chat?.title ?? '', summary, upto_count: msgs.length, updated_at: new Date().toISOString(),
  }, { onConflict: 'chat_id' })
  return true
}
