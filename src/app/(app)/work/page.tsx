'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface Item {
  id: string
  title: string
  notes: string
  done: boolean
  deadline?: number // epoch ms，可選
  updatedAt: number
}

type Row = {
  id: string
  title: string
  notes: string
  done: boolean
  deadline: string | null
  updated_at: string
}
function fromRow(r: Row): Item {
  return {
    id: r.id,
    title: r.title,
    notes: r.notes ?? '',
    done: !!r.done,
    deadline: r.deadline ? new Date(r.deadline).getTime() : undefined,
    updatedAt: new Date(r.updated_at).getTime(),
  }
}

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function deadlineInfo(deadline: number, now: number): { label: string; tone: 'over' | 'soon' | 'normal' } {
  const diff = deadline - now
  const over = diff < 0
  const abs = Math.abs(diff)
  const d = Math.floor(abs / 86400000)
  const h = Math.floor((abs % 86400000) / 3600000)
  const m = Math.floor((abs % 3600000) / 60000)
  const span = d > 0 ? `${d} 天` : h > 0 ? `${h} 小時` : `${m} 分`
  if (over) return { label: `逾期 ${span}`, tone: 'over' }
  return { label: `剩 ${span}`, tone: diff < 86400000 ? 'soon' : 'normal' }
}

function toDateInput(ms?: number) {
  if (!ms) return ''
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 10)
}

export default function WorkPage() {
  const supabase = useRef(createClient()).current
  const [items, setItems] = useState<Item[]>([])
  const [loaded, setLoaded] = useState(false)
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<'active' | 'done' | 'all'>('active')
  const now = useNow()
  const pending = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase
        .from('work_docs')
        .select('id, title, notes, done, deadline, updated_at')
        .order('updated_at', { ascending: false })
      if (!alive) return
      setItems((data ?? []).map(fromRow as (r: unknown) => Item))
      setLoaded(true)
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  useEffect(() => {
    const ch = supabase
      .channel('work_items_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_docs' }, payload => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id: string }).id
          setItems(prev => prev.filter(i => i.id !== id))
          return
        }
        const incoming = fromRow(payload.new as Row)
        setItems(prev => {
          if (pending.current.has(incoming.id)) return prev
          const idx = prev.findIndex(i => i.id === incoming.id)
          if (idx < 0) return [incoming, ...prev]
          if (incoming.updatedAt <= prev[idx].updatedAt) return prev
          const next = [...prev]
          next[idx] = incoming
          return next
        })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [supabase])

  const queueSave = useCallback(
    (item: Item) => {
      const t = pending.current.get(item.id)
      if (t) clearTimeout(t)
      pending.current.set(
        item.id,
        setTimeout(async () => {
          pending.current.delete(item.id)
          await supabase
            .from('work_docs')
            .update({
              title: item.title,
              notes: item.notes,
              done: item.done,
              deadline: item.deadline ? new Date(item.deadline).toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)
        }, 500)
      )
    },
    [supabase]
  )

  const update = useCallback(
    (id: string, patch: Partial<Item>) => {
      setItems(prev =>
        prev.map(i => {
          if (i.id !== id) return i
          const next = { ...i, ...patch, updatedAt: Date.now() }
          queueSave(next)
          return next
        })
      )
    },
    [queueSave]
  )

  async function add() {
    const t = title.trim()
    if (!t) return
    setTitle('')
    const { data } = await supabase
      .from('work_docs')
      .insert({ title: t })
      .select('id, title, notes, done, deadline, updated_at')
      .single()
    if (data) setItems(prev => [fromRow(data as Row), ...prev])
  }

  async function remove(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('work_docs').delete().eq('id', id)
  }

  if (!loaded) {
    return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-muted-foreground">載入中…</div>
  }

  const filtered = items
    .filter(i => (filter === 'active' ? !i.done : filter === 'done' ? i.done : true))
    .sort((a, b) => {
      // 未完成優先；有 deadline 的依到期排前；其餘依更新時間
      if (a.done !== b.done) return a.done ? 1 : -1
      const ad = a.deadline ?? Infinity
      const bd = b.deadline ?? Infinity
      if (ad !== bd) return ad - bd
      return b.updatedAt - a.updatedAt
    })

  const counts = {
    active: items.filter(i => !i.done).length,
    done: items.filter(i => i.done).length,
    all: items.length,
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold">工作項目</h1>
        <p className="text-sm text-muted-foreground">建立工作項目，可選擇性設定截止日期（deadline）。跨裝置自動同步。</p>
      </div>

      {/* 新增 */}
      <Card className="flex gap-2 p-3">
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') add()
          }}
          placeholder="輸入工作項目，按 Enter 新增…"
        />
        <Button onClick={add} disabled={!title.trim()}>新增</Button>
      </Card>

      {/* 篩選 */}
      <div className="flex gap-1">
        {([
          ['active', `進行中 (${counts.active})`],
          ['done', `已完成 (${counts.done})`],
          ['all', `全部 (${counts.all})`],
        ] as const).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? 'default' : 'ghost'}
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* 清單 */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {filter === 'done' ? '尚無已完成項目' : '尚無工作項目，從上方新增'}
          </p>
        )}
        {filtered.map(item => (
          <ItemRow
            key={item.id}
            item={item}
            now={now}
            onToggle={() => update(item.id, { done: !item.done })}
            onTitle={v => update(item.id, { title: v })}
            onNotes={v => update(item.id, { notes: v })}
            onDeadline={ms => update(item.id, { deadline: ms })}
            onDelete={() => remove(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ItemRow({
  item,
  now,
  onToggle,
  onTitle,
  onNotes,
  onDeadline,
  onDelete,
}: {
  item: Item
  now: number
  onToggle: () => void
  onTitle: (v: string) => void
  onNotes: (v: string) => void
  onDeadline: (ms?: number) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const info = item.deadline ? deadlineInfo(item.deadline, now) : null

  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={item.done} onChange={onToggle} className="mt-1.5 h-4 w-4 shrink-0" />

        <div className="min-w-0 flex-1">
          <input
            value={item.title}
            onChange={e => onTitle(e.target.value)}
            className={`w-full bg-transparent text-sm font-medium outline-none ${
              item.done ? 'text-muted-foreground line-through' : ''
            }`}
          />

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {/* deadline 選擇（可不選） */}
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={toDateInput(item.deadline)}
                onChange={e =>
                  onDeadline(e.target.value ? new Date(e.target.value + 'T23:59:59').getTime() : undefined)
                }
                className="h-7 w-36 text-xs"
              />
              {item.deadline && (
                <button
                  onClick={() => onDeadline(undefined)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  title="清除截止日期"
                >
                  ✕
                </button>
              )}
            </div>

            {info && !item.done && (
              <Badge
                variant={info.tone === 'over' ? 'destructive' : 'secondary'}
                className={info.tone === 'soon' ? 'bg-amber-500 text-white' : ''}
              >
                ⏱ {info.label}
              </Badge>
            )}

            <button
              onClick={() => setExpanded(v => !v)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {expanded ? '收合備註' : item.notes ? '備註…' : '加備註'}
            </button>

            <button
              onClick={onDelete}
              className="ml-auto text-xs text-muted-foreground hover:text-red-500"
            >
              刪除
            </button>
          </div>

          {expanded && (
            <Textarea
              value={item.notes}
              onChange={e => onNotes(e.target.value)}
              placeholder="補充說明、細節、連結…"
              rows={3}
              className="mt-2 text-sm"
            />
          )}
        </div>
      </div>
    </Card>
  )
}
