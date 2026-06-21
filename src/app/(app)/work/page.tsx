'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type SB = ReturnType<typeof createClient>
type T = ReturnType<typeof useTranslations>

interface Item {
  id: string
  ownerId: string
  title: string
  status: string
  done: boolean
  deadline?: number
  updatedAt: number
}

type Row = {
  id: string
  user_id: string
  title: string
  status: string
  done: boolean
  deadline: string | null
  updated_at: string
}
function fromRow(r: Row): Item {
  return {
    id: r.id,
    ownerId: r.user_id,
    title: r.title,
    status: r.status ?? '',
    done: !!r.done,
    deadline: r.deadline ? new Date(r.deadline).getTime() : undefined,
    updatedAt: new Date(r.updated_at).getTime(),
  }
}

interface Member {
  id: string
  invited_email: string
  status: string
}
interface Comment {
  id: string
  author_id: string
  author_name: string
  content: string
  created_at: string
}
interface Me {
  id: string
  email: string
  name: string
}

// ── 內容自動翻譯（跨元件共用快取） ──
const transCache = new Map<string, string>()
const ck = (l: string, t: string) => l + '' + t

function useAutoTranslate(texts: string[], locale: string) {
  const [, setTick] = useState(0)
  const joined = texts.join('')
  useEffect(() => {
    const uniq = Array.from(new Set(texts.map(t => (t ?? '').trim()).filter(Boolean)))
    const missing = uniq.filter(t => !transCache.has(ck(locale, t)))
    if (!missing.length) return
    let alive = true
    fetch('/api/work/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: missing, target: locale }),
    })
      .then(r => r.json())
      .then(d => {
        if (!alive || !Array.isArray(d.translations)) return
        missing.forEach((t, i) => transCache.set(ck(locale, t), d.translations[i] ?? t))
        setTick(x => x + 1)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, joined])

  return useCallback(
    (t: string) => {
      const k = (t ?? '').trim()
      return k ? transCache.get(ck(locale, k)) ?? t : t
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, joined]
  )
}

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function deadlineParts(deadline: number, now: number): { over: boolean; n: number; unit: 'dDay' | 'dHour' | 'dMin'; tone: 'over' | 'soon' | 'normal' } {
  const diff = deadline - now
  const abs = Math.abs(diff)
  const d = Math.floor(abs / 86400000)
  const h = Math.floor(abs / 3600000)
  const m = Math.floor(abs / 60000)
  const over = diff < 0
  const tone: 'over' | 'soon' | 'normal' = over ? 'over' : diff < 86400000 ? 'soon' : 'normal'
  if (d > 0) return { over, n: d, unit: 'dDay', tone }
  if (h > 0) return { over, n: h, unit: 'dHour', tone }
  return { over, n: m, unit: 'dMin', tone }
}

function deadlineLabel(t: T, deadline: number, now: number) {
  const p = deadlineParts(deadline, now)
  const span = t(p.unit, { n: p.n })
  return { label: p.over ? t('deadlineOverdue', { span }) : t('deadlineLeft', { span }), tone: p.tone }
}

function toDateInput(ms?: number) {
  if (!ms) return ''
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 10)
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function TranslatedNote({ t, original, tr }: { t: T; original: string; tr: (s: string) => string }) {
  const translated = tr(original)
  if (!original.trim() || translated.trim() === original.trim()) return null
  return <p className="mt-0.5 text-[11px] text-muted-foreground">{t('translatedNote', { text: translated })}</p>
}

export default function WorkPage() {
  const t = useTranslations('Work')
  const locale = useLocale()
  const supabase = useRef(createClient()).current
  const [me, setMe] = useState<Me | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<'active' | 'done' | 'all'>('active')
  const now = useNow()
  const pending = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const tr = useAutoTranslate(items.flatMap(i => [i.title, i.status]), locale)

  // 解析非本人擁有者的顯示名稱
  const resolveOwners = useCallback(
    async (its: Item[], myId: string) => {
      const ids = Array.from(new Set(its.map(i => i.ownerId).filter(id => id !== myId)))
      const unknown = ids.filter(id => !(id in ownerNames))
      if (!unknown.length) return
      const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', unknown)
      const map: Record<string, string> = {}
      for (const p of (data ?? []) as { id: string; full_name?: string; email?: string }[]) {
        map[p.id] = p.full_name || p.email || ''
      }
      setOwnerNames(prev => ({ ...prev, ...map }))
    },
    [supabase, ownerNames]
  )

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user || !alive) return

      await supabase.rpc('claim_work_invitations')

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      const meObj: Me = { id: user.id, email: user.email ?? '', name: profile?.full_name || user.email || 'me' }
      setMe(meObj)

      // RLS 已限定：本人擁有 + 被指派協作的項目
      const { data } = await supabase
        .from('work_docs')
        .select('id, user_id, title, status, done, deadline, updated_at')
        .order('updated_at', { ascending: false })
      const list = (data ?? []).map(fromRow as (r: unknown) => Item)
      if (!alive) return
      setItems(list)
      resolveOwners(list, user.id)
      setLoaded(true)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  // Realtime（postgres_changes 受 RLS 限制，僅收到可存取的列）
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
      const tm = pending.current.get(item.id)
      if (tm) clearTimeout(tm)
      pending.current.set(
        item.id,
        setTimeout(async () => {
          pending.current.delete(item.id)
          await supabase
            .from('work_docs')
            .update({
              title: item.title,
              status: item.status,
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
    const v = title.trim()
    if (!v) return
    setTitle('')
    const { data } = await supabase
      .from('work_docs')
      .insert({ title: v })
      .select('id, user_id, title, status, done, deadline, updated_at')
      .single()
    if (data) setItems(prev => [fromRow(data as Row), ...prev])
  }

  async function remove(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('work_docs').delete().eq('id', id)
  }

  if (!loaded) {
    return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-muted-foreground">{t('loading')}</div>
  }

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
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card className="flex gap-2 p-3">
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') add()
          }}
          placeholder={t('addPlaceholder')}
        />
        <Button onClick={add} disabled={!title.trim()}>{t('add')}</Button>
      </Card>

      <div className="flex gap-1">
        {([
          ['active', t('filterActive', { count: counts.active })],
          ['done', t('filterDone', { count: counts.done })],
          ['all', t('filterAll', { count: counts.all })],
        ] as const).map(([key, label]) => (
          <Button key={key} size="sm" variant={filter === key ? 'default' : 'ghost'} onClick={() => setFilter(key as typeof filter)}>
            {label}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">{filter === 'done' ? t('emptyDone') : t('empty')}</p>
        )}
        {filtered.map(item =>
          me ? (
            <ItemRow
              key={item.id}
              t={t}
              locale={locale}
              tr={tr}
              supabase={supabase}
              me={me}
              item={item}
              now={now}
              ownerName={item.ownerId === me.id ? null : ownerNames[item.ownerId] ?? ''}
              onToggle={() => update(item.id, { done: !item.done })}
              onTitle={v => update(item.id, { title: v })}
              onStatus={v => update(item.id, { status: v })}
              onDeadline={ms => update(item.id, { deadline: ms })}
              onDelete={() => remove(item.id)}
            />
          ) : null
        )}
      </div>
    </div>
  )
}

function ItemMembersPanel({ t, supabase, itemId, ownerId }: { t: T; supabase: SB; itemId: string; ownerId: string }) {
  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('work_item_members')
      .select('id, invited_email, status')
      .eq('item_id', itemId)
      .order('created_at', { ascending: true })
    setMembers((data ?? []) as Member[])
  }, [supabase, itemId])

  useEffect(() => {
    load()
  }, [load])

  async function invite() {
    const e = email.trim().toLowerCase()
    setErr('')
    if (!e) return
    const { error } = await supabase.from('work_item_members').insert({ item_id: itemId, owner_id: ownerId, invited_email: e })
    if (error) {
      setErr(error.code === '23505' ? t('inviteDup') : error.message)
      return
    }
    setEmail('')
    load()
  }

  async function removeMember(id: string) {
    await supabase.from('work_item_members').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
      <p className="text-[11px] text-muted-foreground">{t('membersDesc')}</p>
      <div className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') invite()
          }}
          placeholder={t('invitePlaceholder')}
          className="h-8 text-xs"
        />
        <Button size="sm" onClick={invite} disabled={!email.trim()}>{t('invite')}</Button>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="space-y-1">
        {members.length === 0 && <p className="text-xs text-muted-foreground">{t('noMembers')}</p>}
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-2 text-xs">
            <span className="truncate">{m.invited_email}</span>
            <Badge variant={m.status === 'active' ? 'success' : 'secondary'}>{m.status === 'active' ? t('joined') : t('pending')}</Badge>
            <button onClick={() => removeMember(m.id)} className="ml-auto text-muted-foreground hover:text-red-500">{t('removeMember')}</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ItemRow({
  t,
  locale,
  tr,
  supabase,
  me,
  item,
  now,
  ownerName,
  onToggle,
  onTitle,
  onStatus,
  onDeadline,
  onDelete,
}: {
  t: T
  locale: string
  tr: (s: string) => string
  supabase: SB
  me: Me
  item: Item
  now: number
  ownerName: string | null // null = 自己擁有
  onToggle: () => void
  onTitle: (v: string) => void
  onStatus: (v: string) => void
  onDeadline: (ms?: number) => void
  onDelete: () => void
}) {
  const dl = item.deadline ? deadlineLabel(t, item.deadline, now) : null
  const presets = t.raw('presets') as string[]
  const isOwner = ownerName === null
  const [showMembers, setShowMembers] = useState(false)
  const [memberCount, setMemberCount] = useState<number | null>(null)

  useEffect(() => {
    if (!isOwner) return
    ;(async () => {
      const { count } = await supabase
        .from('work_item_members')
        .select('id', { count: 'exact', head: true })
        .eq('item_id', item.id)
      setMemberCount(count ?? 0)
    })()
  }, [supabase, item.id, isOwner, showMembers])

  return (
    <Card className={`space-y-3 p-3 ${item.done ? 'opacity-70' : ''}`}>
      {/* 標題 + 期限 */}
      <div className="space-y-1.5">
        {ownerName !== null && (
          <Badge variant="secondary" className="mb-1">{t('sharedBy', { name: ownerName })}</Badge>
        )}
        <input
          value={item.title}
          onChange={e => onTitle(e.target.value)}
          className={`w-full bg-transparent text-sm font-semibold outline-none ${item.done ? 'text-muted-foreground line-through' : ''}`}
        />
        <TranslatedNote t={t} original={item.title} tr={tr} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={toDateInput(item.deadline)}
              onChange={e => onDeadline(e.target.value ? new Date(e.target.value + 'T23:59:59').getTime() : undefined)}
              className="h-7 w-36 text-xs"
            />
            {item.deadline && (
              <button onClick={() => onDeadline(undefined)} className="text-xs text-muted-foreground hover:text-foreground" title={t('clearDeadline')}>✕</button>
            )}
          </div>
          {dl && !item.done && (
            <Badge variant={dl.tone === 'over' ? 'destructive' : 'secondary'} className={dl.tone === 'soon' ? 'bg-amber-500 text-white' : ''}>
              ⏱ {dl.label}
            </Badge>
          )}
          {isOwner && (
            <button onClick={() => setShowMembers(v => !v)} className="text-xs text-muted-foreground hover:text-foreground">
              👥 {t('itemCollaborators', { count: memberCount ?? 0 })}
            </button>
          )}
          {isOwner && <button onClick={onDelete} className="ml-auto text-xs text-muted-foreground hover:text-red-500">{t('delete')}</button>}
        </div>
        {isOwner && showMembers && <ItemMembersPanel t={t} supabase={supabase} itemId={item.id} ownerId={me.id} />}
      </div>

      {/* 目前狀態 */}
      <div className="space-y-1.5 rounded-lg bg-muted/40 p-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t('statusLabel')}</span>
          <Input value={item.status} onChange={e => onStatus(e.target.value)} placeholder={t('statusPlaceholder')} className="h-7 flex-1 text-xs" />
        </div>
        <TranslatedNote t={t} original={item.status} tr={tr} />
        <div className="flex flex-wrap gap-1">
          {presets.map(s => (
            <button
              key={s}
              onClick={() => onStatus(s)}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                item.status === s ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 意見區 */}
      <CommentsSection t={t} locale={locale} supabase={supabase} me={me} item={item} />

      {/* 完成（放最後，含文字） */}
      <label className="flex cursor-pointer items-center gap-2 border-t pt-2.5 text-sm">
        <input type="checkbox" checked={item.done} onChange={onToggle} className="h-4 w-4" />
        <span className={item.done ? 'font-medium text-green-600' : 'text-muted-foreground'}>{item.done ? t('doneLabel') : t('markDone')}</span>
      </label>
    </Card>
  )
}

function CommentsSection({ t, locale, supabase, me, item }: { t: T; locale: string; supabase: SB; me: Me; item: Item }) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const loadedOnce = useRef(false)

  const tr = useAutoTranslate(comments.map(c => c.content), locale)

  useEffect(() => {
    ;(async () => {
      const { count: c } = await supabase
        .from('work_comments')
        .select('id', { count: 'exact', head: true })
        .eq('item_id', item.id)
      setCount(c ?? 0)
    })()
  }, [supabase, item.id])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('work_comments')
      .select('id, author_id, author_name, content, created_at')
      .eq('item_id', item.id)
      .order('created_at', { ascending: true })
    setComments((data ?? []) as Comment[])
    setCount((data ?? []).length)
  }, [supabase, item.id])

  useEffect(() => {
    if (open && !loadedOnce.current) {
      loadedOnce.current = true
      load()
    }
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const ch = supabase
      .channel(`work_comments_${item.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'work_comments', filter: `item_id=eq.${item.id}` },
        payload => {
          const c = payload.new as Comment
          setComments(prev => (prev.some(x => x.id === c.id) ? prev : [...prev, c]))
          setCount(prev => (prev ?? 0) + 1)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [supabase, item.id, open])

  async function send() {
    const c = text.trim()
    if (!c) return
    setText('')
    const { data } = await supabase
      .from('work_comments')
      .insert({ item_id: item.id, owner_id: item.ownerId, author_name: me.name, content: c })
      .select('id, author_id, author_name, content, created_at')
      .single()
    if (data) {
      setComments(prev => (prev.some(x => x.id === data.id) ? prev : [...prev, data as Comment]))
      setCount(prev => (prev ?? 0) + 1)
    }
  }

  return (
    <div>
      <button onClick={() => setOpen(v => !v)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
        💬 {t('commentsTitle')}{count ? ` (${count})` : ''} {open ? '▲' : '▼'}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {comments.length === 0 && <p className="text-xs text-muted-foreground">{t('commentsEmpty')}</p>}
          {comments.map(c => {
            const translated = tr(c.content)
            const showOriginal = translated.trim() !== c.content.trim()
            return (
              <div key={c.id} className="rounded-lg border bg-background p-2">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{c.author_name || t('authorFallback')}</span>
                  <span>{fmtTime(c.created_at)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{translated}</p>
                {showOriginal && <p className="mt-0.5 whitespace-pre-wrap text-[11px] text-muted-foreground">{c.content}</p>}
              </div>
            )
          })}
          <div className="flex items-end gap-2">
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
              }}
              placeholder={t('commentsPlaceholder')}
              rows={2}
              className="flex-1 text-sm"
            />
            <Button size="sm" onClick={send} disabled={!text.trim()}>{t('send')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
