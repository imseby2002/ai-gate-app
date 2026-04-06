'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { formatFileSize } from '@/lib/utils/format'
import type { AIModel, Assistant, AssistantFile } from '@/types/database'

interface AssistantFormProps {
  models: AIModel[]
  assistant?: Assistant & { assistant_files?: AssistantFile[] }
}

const EMOJI_OPTIONS = ['🤖', '📊', '⚖️', '📝', '🔬', '💼', '📚', '🎨', '💡', '🌐', '🔧', '📈']
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png', '.json', '.txt']

export function AssistantForm({ models, assistant }: AssistantFormProps) {
  const router = useRouter()
  const isEdit = !!assistant

  const [name, setName] = useState(assistant?.name ?? '')
  const [description, setDescription] = useState(assistant?.description ?? '')
  const [systemPrompt, setSystemPrompt] = useState(assistant?.system_prompt ?? '')
  const [defaultModel, setDefaultModel] = useState(assistant?.default_model ?? '')
  const [avatarEmoji, setAvatarEmoji] = useState(assistant?.avatar_emoji ?? '🤖')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [existingFiles, setExistingFiles] = useState<AssistantFile[]>(assistant?.assistant_files ?? [])
  const [uploadingFiles, setUploadingFiles] = useState<Array<{ name: string; status: 'uploading' | 'done' | 'error'; error?: string }>>([])

  const textModels = models.filter(m => m.modality === 'text' || m.modality === 'multimodal')

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!assistant?.id && !isEdit) return

    for (const file of acceptedFiles) {
      setUploadingFiles(prev => [...prev, { name: file.name, status: 'uploading' }])

      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch(`/api/assistants/${assistant!.id}/files`, {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()

        if (!res.ok) {
          setUploadingFiles(prev =>
            prev.map(f => f.name === file.name ? { ...f, status: 'error', error: data.error } : f)
          )
        } else {
          setExistingFiles(prev => [...prev, data.file])
          setUploadingFiles(prev => prev.filter(f => f.name !== file.name))
        }
      } catch (err) {
        setUploadingFiles(prev =>
          prev.map(f => f.name === file.name ? { ...f, status: 'error', error: String(err) } : f)
        )
      }
    }
  }, [assistant, isEdit])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/json': ['.json'],
      'text/plain': ['.txt'],
    },
    maxSize: 50 * 1024 * 1024,
    disabled: !isEdit,
  })

  const handleDeleteFile = async (fileId: string) => {
    await fetch(`/api/assistants/${assistant!.id}/files?fileId=${fileId}`, { method: 'DELETE' })
    setExistingFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('請輸入助理名稱'); return }
    setSaving(true)
    setError('')

    const payload = { name, description, system_prompt: systemPrompt, default_model: defaultModel || null, avatar_emoji: avatarEmoji }

    const res = await fetch(
      isEdit ? `/api/assistants/${assistant.id}` : '/api/assistants',
      {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error)
    } else {
      router.push(`/assistants/${data.assistant.id}`)
      router.refresh()
    }
  }

  const statusIcon = (status: string) => {
    if (status === 'done') return <CheckCircle className="h-4 w-4 text-green-500" />
    if (status === 'failed') return <AlertCircle className="h-4 w-4 text-red-500" />
    return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {/* Avatar + Name */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-lg">基本設定</h2>

        {/* Emoji picker */}
        <div>
          <label className="block text-sm font-medium mb-2">助理圖示</label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => setAvatarEmoji(emoji)}
                className="text-2xl w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all hover:scale-110"
                style={avatarEmoji === emoji ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)' } : {}}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">助理名稱 *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2"
            placeholder="例如：財務分析助理、法務審查助理"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">描述</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2"
            placeholder="簡短說明這個助理的用途"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">預設模型</label>
          <select
            value={defaultModel}
            onChange={e => setDefaultModel(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-white"
          >
            <option value="">自動路由（推薦）</option>
            {textModels.map(m => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* System Prompt */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-lg">系統提示詞</h2>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          className="w-full min-h-32 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
          placeholder="設定助理的角色、行為與回答風格...&#10;例如：你是一位專業的財務分析師，專注於分析財務報表並提供投資建議。請使用繁體中文回答，並引用具體數據支持你的分析。"
        />
      </div>

      {/* Files */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-lg">知識庫文件</h2>
        {!isEdit && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
            💡 請先儲存助理後，才能上傳文件
          </p>
        )}

        {isEdit && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600">
              {isDragActive ? '放開以上傳...' : '拖放或點擊上傳文件'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              支援 {ALLOWED_EXTENSIONS.join(', ')} · 最大 50MB
            </p>
          </div>
        )}

        {/* File list */}
        {(existingFiles.length > 0 || uploadingFiles.length > 0) && (
          <div className="space-y-2">
            {existingFiles.map(file => (
              <div key={file.id} className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50">
                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.file_name}</p>
                  <p className="text-xs text-gray-500">
                    {file.file_size_bytes ? formatFileSize(file.file_size_bytes) : ''} · {file.processing_status === 'done' ? '已處理' : file.processing_status === 'failed' ? '處理失敗' : '處理中'}
                  </p>
                </div>
                {statusIcon(file.processing_status)}
                <button
                  type="button"
                  onClick={() => handleDeleteFile(file.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {uploadingFiles.map(file => (
              <div key={file.name} className="flex items-center gap-3 p-3 rounded-lg border bg-blue-50">
                <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-blue-500">{file.error ?? '上傳中...'}</p>
                </div>
                {file.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                {file.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-xl text-sm font-medium border hover:bg-gray-50 transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--primary)' }}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? '儲存中...' : isEdit ? '更新助理' : '建立助理'}
        </button>
      </div>
    </form>
  )
}
