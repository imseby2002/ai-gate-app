import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AssistantForm } from '@/components/assistants/AssistantForm'

export default async function EditAssistantPage({
  params,
}: {
  params: Promise<{ assistantId: string }>
}) {
  const { assistantId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: assistant } = await supabase
    .from('assistants')
    .select('*, assistant_files(*)')
    .eq('id', assistantId)
    .eq('user_id', user.id)
    .single()

  if (!assistant) redirect('/assistants')

  const { data: models } = await supabase
    .from('ai_models')
    .select('*')
    .eq('is_enabled', true)
    .order('sort_order')

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {assistant.avatar_emoji} 編輯助理：{assistant.name}
        </h1>
        <p className="text-gray-500 text-sm mt-1">更新助理設定與知識庫文件</p>
      </div>
      <AssistantForm models={models ?? []} assistant={assistant} />
    </div>
  )
}
