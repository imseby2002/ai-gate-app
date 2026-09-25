import { redirect } from 'next/navigation'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { isChatModelAllowed } from '@/lib/ai/chat-policy'
import { ChatPageClient } from '@/components/chat/ChatPageClient'

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ assistantId?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await getCachedUser()
  if (!user) redirect('/login')

  const { assistantId } = await searchParams

  const { data: models } = await supabase
    .from('ai_models')
    .select('*')
    .eq('is_enabled', true)
    .order('sort_order')

  // 付費客戶的 CHAT 只列出免費／低價模型（見 lib/ai/chat-policy.ts）
  const { data: viewer } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  const visibleModels = viewer?.user_type === 'external'
    ? (models ?? []).filter(m => isChatModelAllowed(m.id))
    : (models ?? [])

  const { data: assistants } = await supabase
    .from('assistants')
    .select('id, name, avatar_emoji, description')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(10)

  // 若有 assistantId，載入完整助理資料
  let selectedAssistant = null
  if (assistantId) {
    const { data } = await supabase
      .from('assistants')
      .select('*')
      .eq('id', assistantId)
      .eq('user_id', user.id)
      .single()
    selectedAssistant = data
  }

  return (
    <div className="h-full flex flex-col">
      {/* Assistant Quick Select */}
      {assistants && assistants.length > 0 && (
        <div className="px-4 pt-3 pb-0 flex items-center gap-2 overflow-x-auto border-b">
          <span className="text-xs text-muted-foreground whitespace-nowrap">選擇助理：</span>
          {assistants.map(a => (
            <a
              key={a.id}
              href={`/chat?assistantId=${a.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap hover:bg-accent transition-colors"
            >
              <span>{a.avatar_emoji}</span>
              {a.name}
            </a>
          ))}
        </div>
      )}
      <ChatPageClient
        models={visibleModels}
        assistant={selectedAssistant}
      />
    </div>
  )
}
