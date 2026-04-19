import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AssistantForm } from '@/components/assistants/AssistantForm'

export const runtime = 'edge'

export default async function NewAssistantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: models } = await supabase
    .from('ai_models')
    .select('*')
    .eq('is_enabled', true)
    .order('sort_order')

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">建立 AI 助理</h1>
        <p className="text-gray-500 text-sm mt-1">設定助理的角色與知識庫</p>
      </div>
      <AssistantForm models={models ?? []} />
    </div>
  )
}
