import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Bot, Plus, FileText, MessageSquare, Trash2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/format'

export default async function AssistantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: assistants } = await supabase
    .from('assistants')
    .select('*, assistant_files(id, file_name, file_type, processing_status)')
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
          {assistants.map(assistant => {
            const files = assistant.assistant_files ?? []
            const doneFiles = files.filter((f: { processing_status: string }) => f.processing_status === 'done')
            return (
              <div key={assistant.id} className="bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow group">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{assistant.avatar_emoji}</div>
                      <div>
                        <h3 className="font-semibold">{assistant.name}</h3>
                        {assistant.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{assistant.description}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {doneFiles.length}/{files.length} 檔案
                    </span>
                    <span>更新於 {formatDateTime(assistant.updated_at)}</span>
                  </div>

                  {assistant.system_prompt && (
                    <p className="text-xs text-gray-400 italic line-clamp-2 mb-4 border-l-2 pl-2 border-gray-200">
                      {assistant.system_prompt.slice(0, 100)}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Link
                      href={`/chat?assistantId=${assistant.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white"
                      style={{ background: 'var(--primary)' }}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      開始對話
                    </Link>
                    <Link
                      href={`/assistants/${assistant.id}`}
                      className="flex items-center justify-center px-3 py-2 rounded-lg text-xs font-medium border hover:bg-gray-50"
                    >
                      編輯
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
