import { redirect } from 'next/navigation'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { isChatModelAllowed } from '@/lib/ai/chat-policy'
import { getCompanyBillingContext } from '@/lib/company/entitlements'
import { ChatInterface } from '@/components/chat/ChatInterface'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await getCachedUser()
  if (!user) redirect('/login')

  const { data: conversation } = await supabase
    .from('conversations')
    .select('*, assistants(*)')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!conversation) redirect('/chat')

  // 取最新 50 筆，再轉回時間正序顯示
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(50)
  const orderedMessages = (messages ?? []).reverse()

  const { data: models } = await supabase
    .from('ai_models')
    .select('*')
    .eq('is_enabled', true)
    .order('sort_order')

  // 付費客戶的 CHAT 只列出免費／低價模型（見 lib/ai/chat-policy.ts）
  const { data: viewer } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  // 專屬客製-企業版不受限，列出全部模型
  const unrestricted = viewer?.user_type !== 'external' || !!(await getCompanyBillingContext(user.id))?.enterprise
  const visibleModels = !unrestricted
    ? (models ?? []).filter(m => isChatModelAllowed(m.id))
    : (models ?? [])

  return (
    <ChatInterface
      conversationId={conversationId}
      initialMessages={orderedMessages}
      assistant={conversation.assistants ?? null}
      models={visibleModels}
    />
  )
}
