'use client'

import { User, Bot, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { formatCost, formatTokens } from '@/lib/utils/format'
import { MarkdownContent } from './MarkdownContent'
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
        'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium shadow-sm',
        isUser
          ? 'bg-gradient-to-br from-primary to-violet-600 text-white'
          : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 text-slate-600 dark:text-slate-300'
      )}>
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* Bubble */}
      <div className={cn('max-w-[78%] space-y-1', isUser ? 'items-end flex flex-col' : '')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 shadow-sm',
          isUser
            ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-tr-md'
            : 'bg-card border border-border/50 rounded-tl-md'
        )}>
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
          ) : (
            <MarkdownContent content={content} />
          )}
          {isStreaming && (
            <span className="inline-block h-4 w-0.5 bg-current animate-pulse ml-0.5 align-middle" />
          )}
        </div>

        {/* Meta info for assistant messages */}
        {!isUser && !isStreaming && (message.model_id || (message.cost_usd ?? 0) > 0) && (
          <div className="flex items-center gap-3 px-1 text-xs text-muted-foreground/70">
            {message.modelDisplayName && (
              <span className="font-medium">{message.modelDisplayName}</span>
            )}
            {(message.input_tokens ?? 0) > 0 && (
              <span>{formatTokens((message.input_tokens ?? 0) + (message.output_tokens ?? 0))} tokens</span>
            )}
            {(message.cost_usd ?? 0) > 0 && (
              <span>{formatCost(message.cost_usd ?? 0)}</span>
            )}
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ml-auto p-0.5 rounded"
              title="複製"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        )}

        {/* Image attachments */}
        {message.image_urls?.map((url, i) => (
          <img key={i} src={url} alt="生成圖片" className="rounded-xl max-w-sm mt-2 shadow-sm" />
        ))}
      </div>
    </div>
  )
}
