// 稽核討論AI 自動日誌：把一段稽核對話用 AI 摘要成標準稽核日誌
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import type { createClient } from '@/lib/supabase/server'

type SB = Awaited<ReturnType<typeof createClient>>

export async function summarizeAuditChat(supabase: SB, ownerId: string, chatId: string, force = false): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false
  const { data: chat } = await supabase.from('audit_chats').select('title, store').eq('id', chatId).eq('owner_id', ownerId).single()
  const { data: msgs } = await supabase.from('audit_messages').select('role, content').eq('chat_id', chatId).eq('owner_id', ownerId).order('created_at')
  if (!msgs || msgs.length === 0) return false

  const { data: existing } = await supabase.from('audit_logs').select('upto_count').eq('chat_id', chatId).single()
  if (!force && existing && existing.upto_count >= msgs.length) return false

  const transcript = msgs.map(m => `${m.role === 'assistant' ? '稽核專家AI' : '稽核人員'}：${m.content}`).join('\n')
  const system = `你是連鎖餐飲稽核日誌助理。請把以下稽核人員與稽核討論AI的對話，摘要整理成一份專業精煉的門市稽核日誌（繁體中文）。
格式規範：
・主題：一句話標題
・巡檢門市：${chat?.store || '全門市通用'}
・討論焦點與現場發現：條列 2–4 點（包含操作動線、擺放整潔、人體工學或物料合理性）
・專家建議改善行動：條列 2–4 點具體改善指引
・後續追蹤與複查期限：條列 1–2 點

請直接輸出結構化日誌內容，勿加多餘贅詞。`

  let summary = ''
  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await generateText({
      model: anthropic('claude-sonnet-4-5'),
      system,
      maxOutputTokens: 1000,
      messages: [{ role: 'user', content: transcript.slice(0, 14000) }]
    })
    summary = res.text.trim()
  } catch {
    return false
  }
  if (!summary) return false

  await supabase.from('audit_logs').upsert({
    owner_id: ownerId,
    chat_id: chatId,
    store: chat?.store || '',
    title: chat?.title || '稽核討論日誌',
    summary,
    upto_count: msgs.length,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'chat_id' })

  return true
}
