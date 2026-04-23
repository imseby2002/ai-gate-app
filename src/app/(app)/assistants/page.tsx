import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Bot, Plus } from 'lucide-react'
import { AssistantCard } from '@/components/assistants/AssistantCard'

export default async function AssistantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: assistants } = await supabase
    .from('assistants')
    .select('*, assistant_files(id, file_name, file_type, file_size_bytes, processing_status)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI 助理</h1>
          <p className="text-gray-500 text-sm mt-1">建立含有專屬知識庫的 AI 助理</p>
        </div>
        <Link
          href="/assistants/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'var(--primary)' }}
        >
          <Plus className="h-4 w-4" />
          新建助理
        </Link>
      </div>

      {(!assistants || assistants.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Bot className="h-16 w-16 mb-4 opacity-30" />
          <h2 className="text-lg font-medium mb-2">尚未建立任何助理</h2>
          <p className="text-sm mb-6">建立助理後，可上傳文件讓 AI 學習您的業務知識</p>
          <Link
            href="/assistants/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--primary)' }}
          >
            <Plus className="h-4 w-4" />
            建立第一個助理
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assistants.map(assistant => (
            <AssistantCard key={assistant.id} assistant={assistant} />
          ))}
        </div>
      )}
    </div>
  )
}
