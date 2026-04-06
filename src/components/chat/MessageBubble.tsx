'use client'

import { User, Bot, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { formatCost, formatTokens } from '@/lib/utils/format'
import type { Message } from '@/types/database'

interface MessageBubbleProps {
  message: Message & { modelDisplayName?: string }
  isStreaming?: boolean
  streamingContent?: string
}

export function MessageBubble({ message, isStreaming, streamingContent }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const content = isStreaming ? (streamingContent ?? '') : message.content

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('flex gap-3 group', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={cn(
        'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Bubble */}
      <div className={cn('max-w-[75%] space-y-1', isUser && 'items-end')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted rounded-tl-sm'
        )}>
          {/* Render content - basic markdown-like formatting */}
          <div className="whitespace-pre-wrap">
            {content}
          </div>
          {isStreaming && (
            <span className="inline-block h-4 w-0.5 bg-current animate-pulse ml-0.5" />
          )}
        </div>

        {/* Meta info for assistant messages */}
        {!isUser && !isStreaming && (message.model_id || message.cost_usd > 0) && (
          <div className="flex items-center gap-3 px-1 text-xs text-muted-foreground">
            {message.modelDisplayName && (
              <span>{message.modelDisplayName}</span>
            )}
            {message.input_tokens > 0 && (
              <span>{formatTokens(message.input_tokens + message.output_tokens)} tokens</span>
            )}
            {message.cost_usd > 0 && (
              <span>{formatCost(message.cost_usd)}</span>
            )}
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        )}

        {/* Image attachments */}
        {message.image_urls?.map((url, i) => (
          <img
            key={i}
            src={url}
            alt="生成圖片"
            className="rounded-lg max-w-sm mt-2"
          />
        ))}
      </div>
    </div>
  )
}
