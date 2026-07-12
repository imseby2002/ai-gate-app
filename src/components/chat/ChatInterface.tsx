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
    e.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('圖片大小不可超過 5MB')
      return
    }
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
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // SSE 事件可能被切在 chunk 邊界，保留最後不完整的一行
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

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
            } else if (data.type === 'error') {
              setStreaming(null)
              setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                conversation_id: newConvId ?? '',
                user_id: '',
                role: 'assistant',
                content: `❌ AI 服務錯誤：${data.error}`,
                model_id: null,
                input_tokens: 0, output_tokens: 0, cost_usd: 0,
                image_urls: null, video_url: null, file_refs: null,
                latency_ms: null, finish_reason: 'error',
                created_at: new Date().toISOString(),
              }])
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

  const SUGGESTIONS = assistant ? [] : [
    '幫我分析這份資料的趨勢',
    '寫一封專業的英文商業信件',
    '解釋量子計算的基本原理',
    '幫我規劃本週的工作計畫',
  ]

  return (
    <div className="flex flex-col h-full bg-slate-50/30 dark:bg-background">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-5">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-12">
            <div className="relative">
              <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-4xl shadow-xl shadow-primary/20">
                {assistant?.avatar_emoji ?? '🤖'}
              </div>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-400 border-2 border-background flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">AI</span>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">
                {assistant ? assistant.name : 'AI GATE 助手'}
              </h2>
              <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
                {assistant?.description ?? '直接輸入問題開始對話，系統會自動選擇最適合的 AI 模型回答您。'}
              </p>
            </div>
            {SUGGESTIONS.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="px-3 py-1.5 rounded-full text-xs bg-card border hover:border-primary/50 hover:text-primary transition-colors shadow-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
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
      <div className="border-t bg-card/80 backdrop-blur-sm px-4 md:px-8 py-3">
        {/* Image Preview */}
        {imagePreview && (
          <div className="relative inline-block mb-2">
            <img src={imagePreview} alt="附件" className="h-20 rounded-xl border shadow-sm" />
            <button
              onClick={() => setImagePreview(null)}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Model selector + assistant tag */}
        <div className="flex items-center gap-2 mb-2">
          <ModelSelector models={textModels} value={modelOverride} onChange={setModelOverride} />
          {assistant && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {assistant.avatar_emoji} {assistant.name}
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
              placeholder="輸入訊息… (Enter 送出，Shift+Enter 換行)"
              className="min-h-[44px] max-h-40 resize-none rounded-xl bg-background border-border/70 focus:border-primary/50 transition-colors pr-2"
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
            className="rounded-xl h-11 w-11 flex-shrink-0 border-border/70"
          >
            <Image className="h-4 w-4" />
          </Button>
          <Button
            onClick={sendMessage}
            disabled={isLoading || (!input.trim() && !imagePreview)}
            size="icon"
            className="rounded-xl h-11 w-11 flex-shrink-0 shadow-sm"
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
