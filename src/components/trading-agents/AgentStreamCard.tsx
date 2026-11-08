'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronUp,
  Bot,
  CheckCircle2,
  Maximize2,
  FileText,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

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
  const [modalOpen, setModalOpen] = useState(false)

  const scoreColor = (score ?? 0) > 20
    ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    : (score ?? 0) < -20
    ? 'text-rose-500 bg-rose-500/10 border-rose-500/20'
    : 'text-amber-500 bg-amber-500/10 border-amber-500/20'

  return (
    <>
      <Card className={`p-4 border transition-all duration-200 flex flex-col justify-between ${isStreaming ? 'border-primary ring-1 ring-primary/30 shadow-md' : 'border-border/80 hover:border-primary/40'}`}>
        <div>
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
            <div className={`whitespace-pre-wrap ${!expanded && content.length > 220 ? 'line-clamp-4' : ''}`}>
              {content || (isStreaming ? '正在蒐集數據並建構專項分析模型...' : '等待調度...')}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between">
          {content.length > 220 ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              {expanded ? (
                <>收起預覽 <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>展開內文 <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          ) : <span />}

          {content && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModalOpen(true)}
              className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Maximize2 className="h-3 w-3" />
              查看完整專項研判報告
            </Button>
          )}
        </div>
      </Card>

      {/* Full Report Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              {title} · 完整研判與數據推導報告
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 text-xs">
              <span>模型：{model || 'Auto'}</span>
              {score !== undefined && (
                <span className={`font-mono font-bold ${scoreColor} px-1.5 py-0.5 rounded border text-[11px]`}>
                  綜合評分: {score > 0 ? '+' : ''}{score} / 100
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm leading-relaxed text-foreground">
            {keyPoints.length > 0 && (
              <div className="p-3 bg-muted/40 rounded-xl border border-border/70">
                <div className="text-xs font-bold text-foreground mb-1.5">核心論點提要：</div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {keyPoints.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-primary font-bold">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="whitespace-pre-wrap font-sans bg-card p-4 rounded-xl border text-foreground/90">
              {content}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
