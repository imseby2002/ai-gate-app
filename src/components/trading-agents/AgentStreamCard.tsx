'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, Bot, Sparkles, CheckCircle2 } from 'lucide-react'

interface AgentStreamCardProps {
  role: string
  title: string
  model?: string
  score?: number
  isStreaming?: boolean
  isDone?: boolean
  content: string
  keyPoints?: string[]
  iconColor?: string
}

export function AgentStreamCard({
  title,
  model,
  score,
  isStreaming,
  isDone,
  content,
  keyPoints = [],
  iconColor = 'text-primary',
}: AgentStreamCardProps) {
  const [expanded, setExpanded] = useState(false)

  const scoreColor = (score ?? 0) > 20
    ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    : (score ?? 0) < -20
    ? 'text-rose-500 bg-rose-500/10 border-rose-500/20'
    : 'text-amber-500 bg-amber-500/10 border-amber-500/20'

  return (
    <Card className={`p-4 border transition-all duration-200 ${isStreaming ? 'border-primary ring-1 ring-primary/30 shadow-md' : 'border-border/80'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg bg-primary/10 ${iconColor}`}>
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              {title}
              {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
            </h4>
            {model && (
              <p className="text-[11px] text-muted-foreground font-mono">
                {model}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {score !== undefined && (
            <Badge variant="outline" className={`text-xs font-mono font-bold ${scoreColor}`}>
              評分: {score > 0 ? '+' : ''}{score}
            </Badge>
          )}
          {isStreaming && (
            <Badge variant="secondary" className="text-[11px] animate-pulse bg-primary/20 text-primary">
              分析中...
            </Badge>
          )}
        </div>
      </div>

      {/* Key points preview */}
      {keyPoints.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground border-l-2 border-primary/30 pl-3">
          {keyPoints.map((point, i) => (
            <li key={i} className="line-clamp-1">
              • {point}
            </li>
          ))}
        </ul>
      )}

      {/* Main text content */}
      <div className="mt-3 text-xs leading-relaxed text-foreground/90 font-sans">
        <div className={`whitespace-pre-wrap ${!expanded && content.length > 200 ? 'line-clamp-4' : ''}`}>
          {content || (isStreaming ? '正在蒐集數據並建構專項分析模型...' : '等待調度...')}
        </div>
      </div>

      {content.length > 200 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
        >
          {expanded ? (
            <>收起全文 <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>展開全文 <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}
    </Card>
  )
}
