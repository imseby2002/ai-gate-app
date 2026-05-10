'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageSquare, FileText, Loader2, CheckCircle, AlertCircle, Clock, Trash2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/format'
import type { Assistant, AssistantFile } from '@/types/database'

interface Props {
  assistant: Assistant & { assistant_files: AssistantFile[] }
}

export function AssistantCard({ assistant }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const files = assistant.assistant_files ?? []
  const doneFiles = files.filter(f => f.processing_status === 'done')

  const handleDelete = async () => {
    if (!confirm(`確定刪除助理「${assistant.name}」？此操作無法復原，相關文件也會一併刪除。`)) return
    setDeleting(true)
    await fetch(`/api/assistants/${assistant.id}`, { method: 'DELETE' })
    router.refresh()
  }

  const statusIcon = (status: string) => {
    if (status === 'done') return <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
    if (status === 'failed') return <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
    return <Clock className="h-3 w-3 text-amber-500 flex-shrink-0" />
  }

  return (
    <div className="bg-card rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-3xl flex-shrink-0">{assistant.avatar_emoji}</div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{assistant.name}</h3>
              {assistant.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{assistant.description}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-shrink-0 ml-2 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
            title="刪除助理"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>

        {/* File list - always visible */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <FileText className="h-3.5 w-3.5" />
            <span>知識庫文件 ({doneFiles.length}/{files.length})</span>
          </div>
          {files.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic pl-5">尚未上傳文件</p>
          ) : (
            <div className="space-y-1">
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30 text-xs text-foreground/70">
                  {statusIcon(f.processing_status)}
                  <span className="truncate flex-1">{f.file_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground/60 mb-4">更新於 {formatDateTime(assistant.updated_at)}</p>

        {/* Actions */}
        <div className="flex gap-2">
          <Link
            href={`/chat?assistantId=${assistant.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            開始對話
          </Link>
          <Link
            href={`/assistants/${assistant.id}`}
            className="flex items-center justify-center px-3 py-2 rounded-lg text-xs font-medium border hover:bg-accent"
          >
            編輯
          </Link>
        </div>
      </div>
    </div>
  )
}
