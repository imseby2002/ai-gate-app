'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Pin, PinOff, Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Conversation {
  id: string
  title: string
  updated_at: string
  pinned: boolean
}

export function ConversationItem({ conv }: { conv: Conversation }) {
  const pathname = usePathname()
  const router = useRouter()
  const isActive = pathname === `/chat/${conv.id}`

  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(conv.title)
  const [pinned, setPinned] = useState(conv.pinned)
  const [deleted, setDeleted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (deleted) return null

  async function handleRename() {
    setMenuOpen(false)
    setRenaming(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function submitRename() {
    const newTitle = title.trim() || conv.title
    setTitle(newTitle)
    setRenaming(false)
    await fetch(`/api/conversations/${conv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    })
    router.refresh()
  }

  async function handlePin() {
    setMenuOpen(false)
    const next = !pinned
    setPinned(next)
    await fetch(`/api/conversations/${conv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: next }),
    })
    router.refresh()
  }

  async function handleDelete() {
    setMenuOpen(false)
    setDeleted(true)
    await fetch(`/api/conversations/${conv.id}`, { method: 'DELETE' })
    if (isActive) router.push('/chat')
    router.refresh()
  }

  return (
    <div className="relative group">
      {renaming ? (
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={submitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') submitRename()
            if (e.key === 'Escape') { setTitle(conv.title); setRenaming(false) }
          }}
          className="w-full px-3 py-1.5 rounded-lg text-xs bg-accent text-foreground outline-none border border-primary"
        />
      ) : (
        <Link href={`/chat/${conv.id}`}>
          <div className={cn(
            'flex items-center px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer',
            isActive && 'bg-accent text-foreground'
          )}>
            {pinned && <Pin className="h-2.5 w-2.5 mr-1 flex-shrink-0 text-primary" />}
            <span className="truncate flex-1">{title}</span>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); setMenuOpen(v => !v) }}
              className="ml-1 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted flex-shrink-0"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </div>
        </Link>
      )}

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-0.5 w-36 rounded-lg border bg-popover shadow-md py-1 text-xs">
            <button
              onClick={handleRename}
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent text-foreground"
            >
              <Pencil className="h-3 w-3" /> 重新命名
            </button>
            <button
              onClick={handlePin}
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent text-foreground"
            >
              {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              {pinned ? '取消釘選' : '釘選'}
            </button>
            <div className="border-t my-1" />
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-destructive/10 text-destructive"
            >
              <Trash2 className="h-3 w-3" /> 刪除
            </button>
          </div>
        </>
      )}
    </div>
  )
}
