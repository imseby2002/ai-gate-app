'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'

function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const result: React.ReactNode[] = []
  let remaining = text
  let idx = 0

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      result.push(
        <code key={`${keyPrefix}-c${idx++}`} className="bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5 text-[0.8em] font-mono">
          {codeMatch[1]}
        </code>
      )
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/)
    if (boldMatch) {
      result.push(<strong key={`${keyPrefix}-b${idx++}`} className="font-semibold">{boldMatch[1]}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    const italicMatch = remaining.match(/^\*([^*\s][^*]*)\*/)
    if (italicMatch) {
      result.push(<em key={`${keyPrefix}-i${idx++}`}>{italicMatch[1]}</em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    const next = remaining.search(/`|\*/)
    if (next === -1) {
      result.push(remaining)
      break
    } else if (next === 0) {
      result.push(remaining[0])
      remaining = remaining.slice(1)
    } else {
      result.push(remaining.slice(0, next))
      remaining = remaining.slice(next)
    }
  }

  return result
}

export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  const blocks = content.split(/(```[\s\S]*?```)/g)

  const rendered = blocks.map((block, bi) => {
    if (block.startsWith('```')) {
      const inner = block.slice(3, -3)
      const code = inner.replace(/^[a-z0-9+\-.]*\n/, '').trim()
      return (
        <pre
          key={`block-${bi}`}
          className="chat-code-block bg-black/[0.06] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] rounded-xl p-4 my-3 overflow-x-auto leading-relaxed"
        >
          <code>{code}</code>
        </pre>
      )
    }

    const lines = block.split('\n')
    const nodes: React.ReactNode[] = []
    const listItems: React.ReactNode[] = []
    let listType: 'ul' | 'ol' | null = null
    let listKey = 0

    const flushList = () => {
      if (listItems.length === 0) return
      const Tag = listType === 'ol' ? 'ol' : 'ul'
      nodes.push(
        <Tag
          key={`list-${bi}-${listKey++}`}
          className={cn('pl-5 my-2 space-y-0.5', listType === 'ol' ? 'list-decimal' : 'list-disc')}
        >
          {listItems.splice(0)}
        </Tag>
      )
      listType = null
    }

    lines.forEach((line, li) => {
      const t = line.trim()

      if (t.startsWith('### ')) {
        flushList()
        nodes.push(<h3 key={`h3-${bi}-${li}`} className="font-semibold text-sm mt-4 mb-1">{parseInline(t.slice(4), `h3-${bi}-${li}`)}</h3>)
        return
      }
      if (t.startsWith('## ')) {
        flushList()
        nodes.push(<h2 key={`h2-${bi}-${li}`} className="font-semibold text-base mt-4 mb-1.5">{parseInline(t.slice(3), `h2-${bi}-${li}`)}</h2>)
        return
      }
      if (t.startsWith('# ')) {
        flushList()
        nodes.push(<h1 key={`h1-${bi}-${li}`} className="font-bold text-lg mt-4 mb-2">{parseInline(t.slice(2), `h1-${bi}-${li}`)}</h1>)
        return
      }

      const ulMatch = t.match(/^[-*] (.*)/)
      if (ulMatch) {
        if (listType === 'ol') flushList()
        listType = 'ul'
        listItems.push(<li key={`li-${bi}-${li}`}>{parseInline(ulMatch[1], `li-${bi}-${li}`)}</li>)
        return
      }

      const olMatch = t.match(/^\d+\. (.*)/)
      if (olMatch) {
        if (listType === 'ul') flushList()
        listType = 'ol'
        listItems.push(<li key={`li-${bi}-${li}`}>{parseInline(olMatch[1], `li-${bi}-${li}`)}</li>)
        return
      }

      flushList()

      if (!t) {
        if (li > 0 && lines[li - 1]?.trim()) nodes.push(<div key={`sp-${bi}-${li}`} className="h-2" />)
        return
      }

      nodes.push(
        <p key={`p-${bi}-${li}`}>
          {parseInline(t, `p-${bi}-${li}`)}
        </p>
      )
    })

    flushList()
    return <React.Fragment key={`frag-${bi}`}>{nodes}</React.Fragment>
  })

  return (
    <div className={cn('text-sm leading-relaxed space-y-0.5', className)}>
      {rendered}
    </div>
  )
}
