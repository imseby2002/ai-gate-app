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
  ownerId: string
  title: string
  notes: string
  done: boolean
  deadline?: number
  updatedAt: number
}

type Row = {
  id: string
  user_id: string
  title: string
  notes: string
  done: boolean
  deadline: string | null
  updated_at: string
}
function fromRow(r: Row): Item {
  return {
    id: r.id,
    ownerId: r.user_id,
    title: r.title,
    notes: r.notes ?? '',
    done: !!r.done,
    deadline: r.deadline ? new Date(r.deadline).getTime() : undefined,
    updatedAt: new Date(r.updated_at).getTime(),
  }
}

interface Workspace {
  ownerId: string
  label: string
}
interface Member {
  id: string
  invited_email: string
  status: string
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
  const abs = Math.abs(diff)
  const d = Math.floor(abs / 86400000)
  const h = Math.floor((abs % 86400000) / 3600000)
  const m = Math.floor((abs % 3600000) / 60000)
  const span = d > 0 ? `${d} 天` : h > 0 ? `${h} 小時` : `${m} 分`
  if (diff < 0) return { label: `逾期 ${span}`, tone: 'over' }
  return { label: `剩 ${span}`, tone: diff < 86400000 ? 'soon' : 'normal' }
}

function toDateInput(ms?: number) {
  if (!ms) return ''
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 10)
}

export default function WorkPage() {
  const supabase = useRef(createClient()).current
  const [me, setMe] = useState<{ id: string; email: string } | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [loaded, setLoaded] = useState(false)
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<'active' | 'done' | 'all'>('active')
  const [showMembers, setShowMembers] = useState(false)
  const now = useNow()
  const pending = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const ownerRef = useRef<string | null>(null)
  ownerRef.current = ownerId

  // 初始化：取得使用者、claim 邀請、組工作區清單
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user || !alive) return
      const meObj = { id: user.id, email: user.email ?? '' }
      setMe(meObj)

      await supabase.rpc('claim_work_invitations')

      const { data: memberships } = await supabase
        .from('work_members')
        .select('owner_id, owner:profiles!work_members_owner_id_fkey(email, full_name)')
        .eq('member_id', user.id)
        .eq('status', 'active')

      const ws: Workspace[] = [{ ownerId: user.id, label: '我的工作區' }]
      for (const m of (memberships ?? []) as unknown as { owner_id: string; owner: { email?: string; full_name?: string } | null }[]) {
        ws.push({ ownerId: m.owner_id, label: `${m.owner?.full_name || m.owner?.email || '協作'} 的工作區` })
      }
      if (!alive) return
      setWorkspaces(ws)
      setOwnerId(user.id)
      setLoaded(true)
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  // 載入選定工作區的項目
  useEffect(() => {
    if (!ownerId) return
    let alive = true
    ;(async () => {
      const { data } = await supabase
        .from('work_docs')
        .select('id, user_id, title, notes, done, deadline, updated_at')
        .eq('user_id', ownerId)
        .order('updated_at', { ascending: false })
      if (alive) setItems((data ?? []).map(fromRow as (r: unknown) => Item))
    })()
    return () => {
      alive = false
    }
  }, [supabase, ownerId])

  // Realtime：同工作區協作即時同步
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
        if (incoming.ownerId !== ownerRef.current) return
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
    if (!t || !ownerId) return
    setTitle('')
    const { data } = await supabase
      .from('work_docs')
      .insert({ title: t, user_id: ownerId })
      .select('id, user_id, title, notes, done, deadline, updated_at')
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

  const isOwn = ownerId === me?.id
  const filtered = items
    .filter(i => (filter === 'active' ? !i.done : filter === 'done' ? i.done : true))
    .sort((a, b) => {
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">工作項目</h1>
          <p className="text-sm text-muted-foreground">建立工作項目，deadline 可選。可邀請他人協作，跨裝置即時同步。</p>
        </div>
        {isOwn && (
          <Button variant="outline" size="sm" onClick={() => setShowMembers(v => !v)}>
            👥 協作者
          </Button>
        )}
      </div>

      {/* 工作區切換 */}
      {workspaces.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {workspaces.map(w => (
            <Button
              key={w.ownerId}
              size="sm"
              variant={w.ownerId === ownerId ? 'default' : 'ghost'}
              onClick={() => setOwnerId(w.ownerId)}
            >
              {w.label}
            </Button>
          ))}
        </div>
      )}

      {/* 協作者管理（僅自己的工作區） */}
      {isOwn && showMembers && me && <MembersPanel supabase={supabase} ownerId={me.id} />}

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

      <div className="flex gap-1">
        {([
          ['active', `進行中 (${counts.active})`],
          ['done', `已完成 (${counts.done})`],
          ['all', `全部 (${counts.all})`],
        ] as const).map(([key, label]) => (
          <Button key={key} size="sm" variant={filter === key ? 'default' : 'ghost'} onClick={() => setFilter(key)}>
            {label}
          </Button>
        ))}
      </div>

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

function MembersPanel({ supabase, ownerId }: { supabase: ReturnType<typeof createClient>; ownerId: string }) {
  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('work_members')
      .select('id, invited_email, status')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true })
    setMembers((data ?? []) as Member[])
  }, [supabase, ownerId])

  useEffect(() => {
    load()
  }, [load])

  async function invite() {
    const e = email.trim().toLowerCase()
    setErr('')
    if (!e) return
    const { error } = await supabase.from('work_members').insert({ owner_id: ownerId, invited_email: e })
    if (error) {
      setErr(error.code === '23505' ? '已邀請過此 email' : error.message)
      return
    }
    setEmail('')
    load()
  }

  async function removeMember(id: string) {
    await supabase.from('work_members').delete().eq('id', id)
    load()
  }

  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="text-sm font-medium">協作者</p>
        <p className="text-xs text-muted-foreground">
          以對方 email 邀請。對方用同一個 email 登入後即自動加入，可一起編輯此工作區。
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') invite()
          }}
          placeholder="collaborator@example.com"
        />
        <Button onClick={invite} disabled={!email.trim()}>邀請</Button>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="space-y-1">
        {members.length === 0 && <p className="text-xs text-muted-foreground">尚無協作者</p>}
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-2 text-sm">
            <span className="truncate">{m.invited_email}</span>
            <Badge variant={m.status === 'active' ? 'success' : 'secondary'}>
              {m.status === 'active' ? '已加入' : '待加入'}
            </Badge>
            <button onClick={() => removeMember(m.id)} className="ml-auto text-xs text-muted-foreground hover:text-red-500">
              移除
            </button>
          </div>
        ))}
      </div>
    </Card>
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

            <button onClick={() => setExpanded(v => !v)} className="text-xs text-muted-foreground hover:text-foreground">
              {expanded ? '收合備註' : item.notes ? '備註…' : '加備註'}
            </button>

            <button onClick={onDelete} className="ml-auto text-xs text-muted-foreground hover:text-red-500">
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
