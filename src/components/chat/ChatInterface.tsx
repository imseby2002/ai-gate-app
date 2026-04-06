'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Paperclip, X, Image, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ModelSelector } from './ModelSelector'
import { MessageBubble } from './MessageBubble'
import { cn } from '@/lib/utils/cn'
import type { Message, AIModel, Assistant } from '@/types/database'

interface ChatInterfaceProps {
  conversationId?: string
  initialMessages?: Message[]
  assistant?: Assistant | null
  models: AIModel[]
  onConversationCreated?: (id: string) => void
}

interface StreamingMessage {
  content: string
  modelId: string
}

export function ChatInterface({
  conversationId: initialConversationId,
  initialMessages = [],
  assistant,
  models,
  onConversationCreated,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [modelOverride, setModelOverride] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null)
  const [currentConvId, setCurrentConvId] = useState(initialConversationId)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming?.content])

  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed && !imagePreview) return
    if (isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: currentConvId ?? '',
      user_id: '',
      role: 'user',
      content: trimmed,
      model_id: null,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      image_urls: null,
      video_url: null,
      file_refs: null,
      latency_ms: null,
      finish_reason: null,
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setStreaming({ content: '', modelId: '' })

    const capturedImage = imagePreview
    setImagePreview(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: currentConvId,
          assistantId: assistant?.id,
          modelOverride,
          message: trimmed,
          imageBase64: capturedImage,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        if (err.error === 'insufficient_credits') {
          setStreaming(null)
          setMessages(prev => [...prev, {
            ...userMessage,
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '⚠️ 餘額不足，請前往「帳單」頁面充值後繼續使用。',
          }])
          return
        }
        throw new Error(err.error)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let finalModelId = ''
      let newConvId = currentConvId

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const dataStr = line.slice(6)
          if (dataStr === '[DONE]') continue

          try {
            const data = JSON.parse(dataStr)

            if (data.type === 'meta') {
              finalModelId = data.modelId
              if (data.conversationId && !currentConvId) {
                newConvId = data.conversationId
                setCurrentConvId(data.conversationId)
                onConversationCreated?.(data.conversationId)
              }
            } else if (data.type === 'delta') {
              fullContent += data.content
              setStreaming({ content: fullContent, modelId: finalModelId })
            } else if (data.type === 'done') {
              const assistantMsg: Message = {
                id: crypto.randomUUID(),
                conversation_id: newConvId ?? '',
                user_id: '',
                role: 'assistant',
                content: fullContent,
                model_id: data.modelId,
                input_tokens: data.inputTokens ?? 0,
                output_tokens: data.outputTokens ?? 0,
                cost_usd: data.costUsd ?? 0,
                image_urls: null,
                video_url: null,
                file_refs: null,
                latency_ms: data.latencyMs ?? null,
                finish_reason: 'stop',
                created_at: new Date().toISOString(),
              }
              setMessages(prev => [...prev, assistantMsg])
              setStreaming(null)
            }
          } catch {}
        }
      }
    } catch (error) {
      setStreaming(null)
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        conversation_id: currentConvId ?? '',
        user_id: '',
        role: 'assistant',
        content: `❌ 錯誤：${String(error)}`,
        model_id: null,
        input_tokens: 0, output_tokens: 0, cost_usd: 0,
        image_urls: null, video_url: null, file_refs: null,
        latency_ms: null, finish_reason: 'error',
        created_at: new Date().toISOString(),
      }])
    } finally {
      setIsLoading(false)
    }
  }, [input, imagePreview, isLoading, currentConvId, assistant, modelOverride, onConversationCreated])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const textModels = models.filter(m => m.modality === 'text' || m.modality === 'multimodal')

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="text-5xl">{assistant?.avatar_emoji ?? '🤖'}</div>
            <h2 className="text-xl font-semibold">
              {assistant ? assistant.name : 'AI GATE'}
            </h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              {assistant?.description ?? '選擇一個 AI 助理或直接開始對話。系統會自動為您選擇最合適的模型。'}
            </p>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {streaming && (
          <MessageBubble
            message={{
              id: 'streaming',
              conversation_id: '',
              user_id: '',
              role: 'assistant',
              content: '',
              model_id: streaming.modelId,
              input_tokens: 0, output_tokens: 0, cost_usd: 0,
              image_urls: null, video_url: null, file_refs: null,
              latency_ms: null, finish_reason: null,
              created_at: new Date().toISOString(),
            }}
            isStreaming
            streamingContent={streaming.content}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-background px-4 py-3 space-y-2">
        {/* Image Preview */}
        {imagePreview && (
          <div className="relative inline-block">
            <img src={imagePreview} alt="附件" className="h-20 rounded-lg border" />
            <button
              onClick={() => setImagePreview(null)}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Top bar: model selector */}
        <div className="flex items-center gap-2">
          <ModelSelector models={textModels} value={modelOverride} onChange={setModelOverride} />
          {assistant && (
            <span className="text-xs text-muted-foreground">
              使用助理：{assistant.avatar_emoji} {assistant.name}
            </span>
          )}
        </div>

        {/* Input row */}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="輸入訊息… (Shift+Enter 換行)"
              className="min-h-[44px] max-h-40 pr-10 resize-none"
              rows={1}
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleImageAttach}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            title="附加圖片"
          >
            <Image className="h-4 w-4" />
          </Button>
          <Button
            onClick={sendMessage}
            disabled={isLoading || (!input.trim() && !imagePreview)}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
