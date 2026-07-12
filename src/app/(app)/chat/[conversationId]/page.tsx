import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatInterface } from '@/components/chat/ChatInterface'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

  return (
    <ChatInterface
      conversationId={conversationId}
      initialMessages={orderedMessages}
      assistant={conversation.assistants ?? null}
      models={models ?? []}
    />
  )
}
