'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

type BlockType = 'h1' | 'h2' | 'text' | 'todo' | 'bullet'

interface Block {
  id: string
  type: BlockType
  text: string
  done?: boolean
}

interface Doc {
  id: string
  title: string
  blocks: Block[]
  deadline?: number // epoch ms, 時間限制
  updatedAt: number
}

const uid = () => Math.random().toString(36).slice(2, 10)

// DB row <-> client doc
type Row = {
  id: string
  title: string
  blocks: Block[]
  deadline: string | null
  updated_at: string
}
function fromRow(r: Row): Doc {
  return {
    id: r.id,
    title: r.title,
    blocks: Array.isArray(r.blocks) && r.blocks.length ? r.blocks : [{ id: uid(), type: 'text', text: '' }],
    deadline: r.deadline ? new Date(r.deadline).getTime() : undefined,
    updatedAt: new Date(r.updated_at).getTime(),
  }
}

const TYPE_CYCLE: BlockType[] = ['text', 'h1', 'h2', 'todo', 'bullet']
const TYPE_LABEL: Record<BlockType, string> = {
  h1: 'H1',
  h2: 'H2',
  text: '文字',
  todo: '待辦',
  bullet: '清單',
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function formatRemaining(deadline: number, now: number): { label: string; over: boolean; soon: boolean } {
  let diff = deadline - now
  const over = diff < 0
  diff = Math.abs(diff)
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  const parts = d > 0 ? `${d}天 ${h}小時` : h > 0 ? `${h}小時 ${m}分` : `${m}分 ${s}秒`
  return { label: over ? `已逾期 ${parts}` : `剩餘 ${parts}`, over, soon: !over && deadline - now < 3600000 }
}

function toLocalInput(ms?: number) {
  if (!ms) return ''
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

export default function WorkPage() {
  const supabase = useRef(createClient()).current
  const [docs, setDocs] = useState<Doc[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const now = useNow()

  // 待寫入的 doc id -> timer
  const pending = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // 初次載入
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase
        .from('work_docs')
        .select('id, title, blocks, deadline, updated_at')
        .order('updated_at', { ascending: false })
      if (!alive) return
      const list = (data ?? []).map(fromRow as (r: unknown) => Doc)
      setDocs(list)
      setActiveId(list[0]?.id ?? null)
      setLoaded(true)
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  // Realtime：其他裝置變更時同步
  useEffect(() => {
    const ch = supabase
      .channel('work_docs_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_docs' }, payload => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id: string }).id
          setDocs(prev => prev.filter(d => d.id !== id))
          return
        }
        const incoming = fromRow(payload.new as Row)
        setDocs(prev => {
          const i = prev.findIndex(d => d.id === incoming.id)
          // 本機正在編輯（有 pending 寫入）時不覆蓋，避免打字被回沖
          if (pending.current.has(incoming.id)) return prev
          if (i < 0) return [incoming, ...prev]
          if (incoming.updatedAt <= prev[i].updatedAt) return prev
          const next = [...prev]
          next[i] = incoming
          return next
        })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [supabase])

  const queueSave = useCallback(
    (doc: Doc) => {
      const t = pending.current.get(doc.id)
      if (t) clearTimeout(t)
      pending.current.set(
        doc.id,
        setTimeout(async () => {
          pending.current.delete(doc.id)
          setSaving(true)
          await supabase
            .from('work_docs')
            .update({
              title: doc.title,
              blocks: doc.blocks,
              deadline: doc.deadline ? new Date(doc.deadline).toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', doc.id)
          setSaving(false)
        }, 600)
      )
    },
    [supabase]
  )

  const active = docs.find(d => d.id === activeId) ?? null

  const update = useCallback(
    (id: string, fn: (d: Doc) => Doc) => {
      setDocs(prev =>
        prev.map(d => {
          if (d.id !== id) return d
          const next = { ...fn(d), updatedAt: Date.now() }
          queueSave(next)
          return next
        })
      )
    },
    [queueSave]
  )

  async function create() {
    const { data } = await supabase
      .from('work_docs')
      .insert({ title: '未命名頁面', blocks: [{ id: uid(), type: 'text', text: '' }] })
      .select('id, title, blocks, deadline, updated_at')
      .single()
    if (data) {
      const d = fromRow(data as Row)
      setDocs(prev => [d, ...prev])
      setActiveId(d.id)
    }
  }

  async function remove(id: string) {
    setDocs(prev => prev.filter(d => d.id !== id))
    if (activeId === id) setActiveId(prev => docs.find(d => d.id !== id)?.id ?? null)
    await supabase.from('work_docs').delete().eq('id', id)
  }

  function setBlocks(fn: (b: Block[]) => Block[]) {
    if (!active) return
    update(active.id, d => ({ ...d, blocks: fn(d.blocks) }))
  }

  function editBlock(bid: string, patch: Partial<Block>) {
    setBlocks(bs => bs.map(b => (b.id === bid ? { ...b, ...patch } : b)))
  }

  function addBlockAfter(bid: string) {
    setBlocks(bs => {
      const i = bs.findIndex(b => b.id === bid)
      const nb: Block = { id: uid(), type: 'text', text: '' }
      const next = [...bs]
      next.splice(i + 1, 0, nb)
      return next
    })
  }

  function removeBlock(bid: string) {
    setBlocks(bs => (bs.length <= 1 ? bs : bs.filter(b => b.id !== bid)))
  }

  function cycleType(bid: string, current: BlockType) {
    const next = TYPE_CYCLE[(TYPE_CYCLE.indexOf(current) + 1) % TYPE_CYCLE.length]
    editBlock(bid, { type: next })
  }

  if (!loaded) {
    return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-muted-foreground">載入中…</div>
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-6xl gap-4 p-4">
      {/* 側欄：頁面清單 */}
      <aside className="flex w-64 shrink-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">工作區</h1>
          <Button size="sm" onClick={create}>＋ 新頁面</Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {docs.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">尚無頁面，點「新頁面」開始</p>
          )}
          {docs.map(d => {
            const r = d.deadline ? formatRemaining(d.deadline, now) : null
            return (
              <button
                key={d.id}
                onClick={() => setActiveId(d.id)}
                className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  d.id === activeId ? 'bg-primary/10 font-medium' : 'hover:bg-muted'
                }`}
              >
                <div className="truncate">{d.title || '未命名頁面'}</div>
                {r && (
                  <div className={`mt-0.5 text-xs ${r.over ? 'text-red-500' : r.soon ? 'text-amber-500' : 'text-muted-foreground'}`}>
                    ⏱ {r.label}
                  </div>
                )}
              </button>
            )
          })}
        </div>
        <div className="px-2 text-xs text-muted-foreground">
          {saving ? '同步中…' : '已同步 ☁'}
        </div>
      </aside>

      {/* 編輯區 */}
      <main className="flex-1 overflow-y-auto">
        {!active ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            選擇或建立一個頁面
          </div>
        ) : (
          <DocEditor
            key={active.id}
            doc={active}
            now={now}
            onTitle={t => update(active.id, d => ({ ...d, title: t }))}
            onDeadline={ms => update(active.id, d => ({ ...d, deadline: ms }))}
            onDelete={() => remove(active.id)}
            onEditBlock={editBlock}
            onAddAfter={addBlockAfter}
            onRemoveBlock={removeBlock}
            onCycleType={cycleType}
          />
        )}
      </main>
    </div>
  )
}

function DocEditor({
  doc,
  now,
  onTitle,
  onDeadline,
  onDelete,
  onEditBlock,
  onAddAfter,
  onRemoveBlock,
  onCycleType,
}: {
  doc: Doc
  now: number
  onTitle: (t: string) => void
  onDeadline: (ms?: number) => void
  onDelete: () => void
  onEditBlock: (bid: string, patch: Partial<Block>) => void
  onAddAfter: (bid: string) => void
  onRemoveBlock: (bid: string) => void
  onCycleType: (bid: string, current: BlockType) => void
}) {
  const r = doc.deadline ? formatRemaining(doc.deadline, now) : null
  const locked = r?.over ?? false

  return (
    <Card className="mx-auto max-w-3xl space-y-4 p-6">
      <input
        value={doc.title}
        onChange={e => onTitle(e.target.value)}
        placeholder="未命名頁面"
        className="w-full bg-transparent text-3xl font-bold outline-none placeholder:text-muted-foreground/50"
      />

      {/* 時間限制列 */}
      <div className="flex flex-wrap items-center gap-3 border-y py-3">
        <span className="text-sm font-medium">⏱ 時間限制</span>
        <Input
          type="datetime-local"
          value={toLocalInput(doc.deadline)}
          onChange={e => onDeadline(e.target.value ? new Date(e.target.value).getTime() : undefined)}
          className="w-56"
        />
        {r && (
          <Badge variant={r.over ? 'destructive' : 'secondary'} className={r.soon ? 'bg-amber-500 text-white' : ''}>
            {r.label}
          </Badge>
        )}
        {doc.deadline && (
          <Button size="sm" variant="ghost" onClick={() => onDeadline(undefined)}>清除</Button>
        )}
        <div className="ml-auto">
          <Button size="sm" variant="ghost" className="text-red-500" onClick={onDelete}>刪除頁面</Button>
        </div>
      </div>

      {locked && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">
          此頁面已逾期，內容已鎖定為唯讀。延後或清除時間限制即可繼續編輯。
        </div>
      )}

      {/* 區塊編輯 */}
      <div className={`space-y-1 ${locked ? 'pointer-events-none opacity-60' : ''}`}>
        {doc.blocks.map(b => (
          <BlockRow
            key={b.id}
            block={b}
            onChange={text => onEditBlock(b.id, { text })}
            onToggle={() => onEditBlock(b.id, { done: !b.done })}
            onEnter={() => onAddAfter(b.id)}
            onBackspaceEmpty={() => onRemoveBlock(b.id)}
            onCycle={() => onCycleType(b.id, b.type)}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Enter 新增區塊・空白行 Backspace 刪除・點左側標籤切換區塊類型（文字 / H1 / H2 / 待辦 / 清單）
      </p>
    </Card>
  )
}

function BlockRow({
  block,
  onChange,
  onToggle,
  onEnter,
  onBackspaceEmpty,
  onCycle,
}: {
  block: Block
  onChange: (t: string) => void
  onToggle: () => void
  onEnter: () => void
  onBackspaceEmpty: () => void
  onCycle: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [block.text])

  const cls =
    block.type === 'h1'
      ? 'text-2xl font-bold'
      : block.type === 'h2'
        ? 'text-xl font-semibold'
        : 'text-sm leading-relaxed'

  return (
    <div className="group flex items-start gap-2">
      <button
        onClick={onCycle}
        className="mt-1 w-10 shrink-0 rounded text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
        title="切換類型"
      >
        {TYPE_LABEL[block.type]}
      </button>

      {block.type === 'todo' && (
        <input
          type="checkbox"
          checked={!!block.done}
          onChange={onToggle}
          className="mt-1.5 shrink-0"
        />
      )}
      {block.type === 'bullet' && <span className="mt-1 shrink-0 select-none">•</span>}

      <textarea
        ref={ref}
        value={block.text}
        rows={1}
        placeholder="輸入內容…"
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onEnter()
          } else if (e.key === 'Backspace' && block.text === '') {
            e.preventDefault()
            onBackspaceEmpty()
          }
        }}
        className={`flex-1 resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted-foreground/40 ${cls} ${
          block.type === 'todo' && block.done ? 'text-muted-foreground line-through' : ''
        }`}
      />
    </div>
  )
}
