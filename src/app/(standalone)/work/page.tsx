'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Building2, Wallet, UtensilsCrossed, Mic, FlaskConical } from 'lucide-react'

type SB = ReturnType<typeof createClient>
type T = ReturnType<typeof useTranslations>

interface Item {
  id: string
  ownerId: string
  parentId: string | null
  title: string
  status: string
  done: boolean
  deadline?: number
  updatedAt: number
}

type Row = {
  id: string
  user_id: string
  parent_id: string | null
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
    parentId: r.parent_id ?? null,
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
interface Contact {
  email: string
  name: string
  memberId?: string
  joined: boolean
}
interface Comment {
  id: string
  author_id: string
  author_name: string
  content: string
  kind: 'text' | 'link' | 'file'
  url: string | null
  file_name: string | null
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
  const [canHr, setCanHr] = useState(false)
  const [canFinance, setCanFinance] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({})
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loaded, setLoaded] = useState(false)
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<'active' | 'done' | 'all'>('active')
  const [scope, setScope] = useState<'all' | 'mine' | 'shared'>('all')
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

  // 收集「曾邀請過的人」作為聯絡人名單（含姓名）
  const loadContacts = useCallback(
    async (myId: string) => {
      const { data } = await supabase
        .from('work_item_members')
        .select('invited_email, member_id, status')
        .eq('owner_id', myId)
      const rows = (data ?? []) as { invited_email: string; member_id: string | null; status: string }[]
      const byEmail = new Map<string, { email: string; memberId?: string; joined: boolean }>()
      for (const r of rows) {
        const email = r.invited_email.toLowerCase()
        const cur = byEmail.get(email)
        const joined = r.status === 'active'
        if (!cur || (joined && !cur.joined)) byEmail.set(email, { email, memberId: r.member_id ?? cur?.memberId, joined: joined || !!cur?.joined })
      }
      const memberIds = Array.from(byEmail.values()).map(c => c.memberId).filter(Boolean) as string[]
      const names: Record<string, string> = {}
      if (memberIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', memberIds)
        for (const p of (profs ?? []) as { id: string; full_name?: string; email?: string }[]) names[p.id] = p.full_name || p.email || ''
      }
      const list: Contact[] = Array.from(byEmail.values()).map(c => ({
        email: c.email,
        memberId: c.memberId,
        joined: c.joined,
        name: (c.memberId && names[c.memberId]) || c.email,
      }))
      list.sort((a, b) => a.name.localeCompare(b.name))
      setContacts(list)
    },
    [supabase]
  )

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user || !alive) return

      await supabase.rpc('claim_work_invitations')

      const { data: profile } = await supabase.from('profiles').select('full_name, user_type, enabled_modules').eq('id', user.id).single()
      const meObj: Me = { id: user.id, email: user.email ?? '', name: profile?.full_name || user.email || 'me' }
      setMe(meObj)
      const isAdmin = profile?.user_type === 'admin'
      const mods: string[] = profile?.enabled_modules ?? []
      setCanHr(isAdmin || mods.includes('hr'))
      setCanFinance(isAdmin || mods.includes('finance'))

      // RLS 已限定：本人擁有 + 被指派協作的項目（只取頂層，子項目另載）
      const { data } = await supabase
        .from('work_docs')
        .select('id, user_id, parent_id, title, status, done, deadline, updated_at')
        .is('parent_id', null)
        .order('updated_at', { ascending: false })
      const list = (data ?? []).map(fromRow as (r: unknown) => Item)
      if (!alive) return
      setItems(list)
      resolveOwners(list, user.id)
      loadContacts(user.id)
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
        if (incoming.parentId) return // 子項目不進頂層清單
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
      .select('id, user_id, parent_id, title, status, done, deadline, updated_at')
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

  const myId = me?.id
  const filtered = items
    .filter(i => (scope === 'mine' ? i.ownerId === myId : scope === 'shared' ? i.ownerId !== myId : true))
    .filter(i => (filter === 'active' ? !i.done : filter === 'done' ? i.done : true))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      const ad = a.deadline ?? Infinity
      const bd = b.deadline ?? Infinity
      if (ad !== bd) return ad - bd
      return b.updatedAt - a.updatedAt
    })

  const scoped = items.filter(i => (scope === 'mine' ? i.ownerId === myId : scope === 'shared' ? i.ownerId !== myId : true))
  const counts = {
    active: scoped.filter(i => !i.done).length,
    done: scoped.filter(i => i.done).length,
    all: scoped.length,
  }
  const scopeCounts = {
    mine: items.filter(i => i.ownerId === myId).length,
    shared: items.filter(i => i.ownerId !== myId).length,
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canHr && (
            <Link href="/hr">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Building2 className="h-4 w-4" />人事管理
              </Button>
            </Link>
          )}
          {canFinance && (
            <Link href="/finance">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Wallet className="h-4 w-4" />出納總務
              </Button>
            </Link>
          )}
          <Link href="/rd">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FlaskConical className="h-4 w-4 text-purple-600 text-sm" />研發
            </Button>
          </Link>
          <Link href="/pos">
            <Button variant="outline" size="sm" className="gap-1.5">
              <UtensilsCrossed className="h-4 w-4" />門市點單
            </Button>
          </Link>
          <Link href="/meeting">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Mic className="h-4 w-4" />{t('meetingNotes')}
            </Button>
          </Link>
        </div>
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

      {/* 來源 + 狀態：同一列，小螢幕自動換行 */}
      <div className="flex flex-wrap items-center gap-1">
        {([
          ['all', t('scopeAll')],
          ['mine', `${t('scopeMine')} (${scopeCounts.mine})`],
          ['shared', `${t('scopeShared')} (${scopeCounts.shared})`],
        ] as const).map(([key, label]) => (
          <Button key={key} size="sm" variant={scope === key ? 'default' : 'ghost'} onClick={() => setScope(key as typeof scope)}>
            {label}
          </Button>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" />
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
              contacts={contacts}
              onContactsChange={() => loadContacts(me.id)}
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

function ItemMembersPanel({
  t,
  supabase,
  itemId,
  ownerId,
  contacts,
  onContactsChange,
}: {
  t: T
  supabase: SB
  itemId: string
  ownerId: string
  contacts: Contact[]
  onContactsChange: () => void
}) {
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

  const onItem = new Set(members.map(m => m.invited_email.toLowerCase()))
  const nameOf = (mail: string) => contacts.find(c => c.email === mail.toLowerCase())?.name ?? mail
  const available = contacts.filter(c => !onItem.has(c.email))

  // 加入既有聯絡人（已加入過者直接生效，免重登）
  async function addContact(c: Contact) {
    setErr('')
    const payload: Record<string, unknown> = { item_id: itemId, owner_id: ownerId, invited_email: c.email }
    if (c.memberId) {
      payload.member_id = c.memberId
      payload.status = 'active'
    }
    const { error } = await supabase.from('work_item_members').insert(payload)
    if (error && error.code !== '23505') {
      setErr(error.message)
      return
    }
    load()
  }

  // 邀請全新 email
  async function inviteNew() {
    const e = email.trim().toLowerCase()
    setErr('')
    if (!e) return
    const known = contacts.find(c => c.email === e)
    if (known) {
      await addContact(known)
      setEmail('')
      return
    }
    const { error } = await supabase.from('work_item_members').insert({ item_id: itemId, owner_id: ownerId, invited_email: e })
    if (error) {
      setErr(error.code === '23505' ? t('inviteDup') : error.message)
      return
    }
    setEmail('')
    load()
    onContactsChange()
  }

  async function removeMember(id: string) {
    await supabase.from('work_item_members').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
      {/* 目前此項目的協作者 */}
      <div className="space-y-1">
        {members.length === 0 && <p className="text-xs text-muted-foreground">{t('noMembers')}</p>}
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-2 text-xs">
            <span className="truncate font-medium">{nameOf(m.invited_email)}</span>
            <span className="truncate text-muted-foreground">{m.invited_email}</span>
            <Badge variant={m.status === 'active' ? 'success' : 'secondary'}>{m.status === 'active' ? t('joined') : t('pending')}</Badge>
            <button onClick={() => removeMember(m.id)} className="ml-auto text-muted-foreground hover:text-red-500">{t('removeMember')}</button>
          </div>
        ))}
      </div>

      {/* 從既有聯絡人挑選 */}
      {available.length > 0 && (
        <select
          value=""
          onChange={e => {
            const c = available.find(x => x.email === e.target.value)
            if (c) addContact(c)
          }}
          className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none"
        >
          <option value="">{t('selectContact')}</option>
          {available.map(c => (
            <option key={c.email} value={c.email}>
              {c.name === c.email ? c.email : `${c.name} (${c.email})`}
            </option>
          ))}
        </select>
      )}

      {/* 邀請新 email */}
      <div className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') inviteNew()
          }}
          placeholder={t('newEmail')}
          className="h-8 text-xs"
        />
        <Button size="sm" onClick={inviteNew} disabled={!email.trim()}>{t('addContact')}</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{t('membersDesc')}</p>
      {err && <p className="text-xs text-red-500">{err}</p>}
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
  contacts,
  onContactsChange,
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
  contacts: Contact[]
  onContactsChange: () => void
  onToggle: () => void
  onTitle: (v: string) => void
  onStatus: (v: string) => void
  onDeadline: (ms?: number) => void
  onDelete: () => void
}) {
  const dl = item.deadline ? deadlineLabel(t, item.deadline, now) : null
  const presets = t.raw('presets') as string[]
  const isOwner = ownerName === null
  const [expanded, setExpanded] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [subVer, setSubVer] = useState(0)
  const statusText = item.status ? tr(item.status) : ''

  const createSubitem = useCallback(
    async (childTitle: string) => {
      const v = childTitle.trim()
      if (!v) return
      await supabase.from('work_docs').insert({ title: v, parent_id: item.id })
      setSubVer(x => x + 1)
    },
    [supabase, item.id]
  )

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
    <Card className={`p-3 ${item.done ? 'opacity-70' : ''}`}>
      {/* 精簡列：標題 + 目前狀態 + deadline（一眼可看完） */}
      <div className="flex items-center gap-2">
        <button onClick={() => setExpanded(v => !v)} className="shrink-0 text-xs text-muted-foreground hover:text-foreground" title="展開">
          {expanded ? '▾' : '▸'}
        </button>
        {expanded ? (
          <input
            value={item.title}
            onChange={e => onTitle(e.target.value)}
            className={`min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none ${item.done ? 'text-muted-foreground line-through' : ''}`}
          />
        ) : (
          <button onClick={() => setExpanded(true)} className="min-w-0 flex-1 text-left">
            <span className={`text-sm font-semibold ${item.done ? 'text-muted-foreground line-through' : ''}`}>
              {item.done && '✅ '}
              {item.title || '—'}
            </span>
            {ownerName !== null && <span className="ml-2 text-[11px] text-muted-foreground">· {t('sharedBy', { name: ownerName })}</span>}
          </button>
        )}
        {!expanded && statusText && (
          <Badge variant="secondary" className="shrink-0 max-w-[10rem] truncate">{statusText}</Badge>
        )}
        {!expanded && dl && !item.done && (
          <Badge variant={dl.tone === 'over' ? 'destructive' : 'secondary'} className={`shrink-0 ${dl.tone === 'soon' ? 'bg-amber-500 text-white' : ''}`}>
            ⏱ {dl.label}
          </Badge>
        )}
      </div>

      {/* 展開後的完整內容 */}
      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <TranslatedNote t={t} original={item.title} tr={tr} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">{t('deadlineFieldLabel')}</span>
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
                {dl && !item.done && (
                  <Badge variant={dl.tone === 'over' ? 'destructive' : 'secondary'} className={`ml-1 ${dl.tone === 'soon' ? 'bg-amber-500 text-white' : ''}`}>
                    ⏱ {dl.label}
                  </Badge>
                )}
              </div>
              {isOwner && (
                <button onClick={() => setShowMembers(v => !v)} className="text-xs text-muted-foreground hover:text-foreground">
                  👥 {t('itemCollaborators', { count: memberCount ?? 0 })}
                </button>
              )}
              {isOwner && <button onClick={onDelete} className="ml-auto text-xs text-muted-foreground hover:text-red-500">{t('delete')}</button>}
            </div>
            {isOwner && showMembers && (
              <ItemMembersPanel t={t} supabase={supabase} itemId={item.id} ownerId={me.id} contacts={contacts} onContactsChange={onContactsChange} />
            )}
          </div>

          {/* 目前狀態：一行下拉（含自訂） */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">{t('statusLabel')}</span>
            <StatusSelect t={t} presets={presets} value={item.status} onChange={onStatus} />
          </div>
          <TranslatedNote t={t} original={item.status} tr={tr} />

          {/* 子項目 */}
          <SubItems t={t} tr={tr} supabase={supabase} parent={item} refresh={subVer} onCreate={createSubitem} />

          {/* 報告（文字／連結／檔案，可轉子項目） */}
          <ReportsSection t={t} locale={locale} supabase={supabase} me={me} item={item} onMakeSubitem={createSubitem} />

          {/* 完成（僅持有人可勾選） */}
          <label className={`flex items-center gap-2 border-t pt-2.5 text-sm ${isOwner ? 'cursor-pointer' : 'cursor-not-allowed'}`} title={isOwner ? '' : t('ownerOnlyDone')}>
            <input type="checkbox" checked={item.done} onChange={onToggle} disabled={!isOwner} className="h-4 w-4" />
            <span className={item.done ? 'font-medium text-green-600' : 'text-muted-foreground'}>{item.done ? t('doneLabel') : t('markDone')}</span>
            {!isOwner && <span className="text-[11px] text-muted-foreground">（{t('ownerOnlyDone')}）</span>}
          </label>
        </div>
      )}
    </Card>
  )
}

function StatusSelect({ t, presets, value, onChange }: { t: T; presets: string[]; value: string; onChange: (v: string) => void }) {
  const isPreset = value === '' || presets.includes(value)
  const [custom, setCustom] = useState(!isPreset)
  return (
    <div className="flex flex-1 items-center gap-2">
      <select
        value={custom ? '__custom__' : value}
        onChange={e => {
          if (e.target.value === '__custom__') {
            setCustom(true)
            onChange('')
          } else {
            setCustom(false)
            onChange(e.target.value)
          }
        }}
        className="h-7 rounded-md border bg-background px-2 text-xs outline-none"
      >
        <option value="">—</option>
        {presets.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
        <option value="__custom__">{t('statusCustom')}</option>
      </select>
      {custom && (
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder={t('statusPlaceholder')} className="h-7 flex-1 text-xs" />
      )}
    </div>
  )
}

function SubItems({
  t,
  tr,
  supabase,
  parent,
  refresh,
  onCreate,
}: {
  t: T
  tr: (s: string) => string
  supabase: SB
  parent: Item
  refresh: number
  onCreate: (title: string) => Promise<void>
}) {
  const [subs, setSubs] = useState<Item[]>([])
  const [title, setTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('work_docs')
      .select('id, user_id, parent_id, title, status, done, deadline, updated_at')
      .eq('parent_id', parent.id)
      .order('created_at', { ascending: true })
    setSubs((data ?? []).map(fromRow as (r: unknown) => Item))
  }, [supabase, parent.id])

  useEffect(() => {
    load()
  }, [load, refresh])

  async function add() {
    const v = title.trim()
    if (!v) return
    setTitle('')
    await onCreate(v)
    load()
  }

  async function toggle(s: Item) {
    setSubs(prev => prev.map(x => (x.id === s.id ? { ...x, done: !x.done } : x)))
    await supabase.from('work_docs').update({ done: !s.done, updated_at: new Date().toISOString() }).eq('id', s.id)
  }

  async function remove(id: string) {
    setSubs(prev => prev.filter(x => x.id !== id))
    await supabase.from('work_docs').delete().eq('id', id)
  }

  function startEdit(s: Item) {
    setEditingId(s.id)
    setDraft(s.title)
  }

  async function saveEdit(id: string) {
    const v = draft.trim()
    setEditingId(null)
    if (!v) return
    setSubs(prev => prev.map(x => (x.id === id ? { ...x, title: v } : x)))
    await supabase.from('work_docs').update({ title: v, updated_at: new Date().toISOString() }).eq('id', id)
  }

  return (
    <div className="space-y-1.5 rounded-lg border p-2.5">
      <p className="text-xs font-medium text-muted-foreground">{t('subitems')}{subs.length ? ` (${subs.length})` : ''}</p>
      {subs.map(s => {
        const trd = tr(s.title)
        const editing = editingId === s.id
        return (
          <div key={s.id} className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={s.done} onChange={() => toggle(s)} className="mt-1 h-3.5 w-3.5 shrink-0" />
            {editing ? (
              <div className="min-w-0 flex-1 space-y-1">
                <Textarea
                  autoFocus
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setEditingId(null)
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit(s.id)
                  }}
                  rows={Math.min(8, Math.max(2, draft.split('\n').length))}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(s.id)} disabled={!draft.trim()}>{t('save')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>{t('cancel')}</Button>
                </div>
              </div>
            ) : (
              <span
                onDoubleClick={() => startEdit(s)}
                className={`min-w-0 flex-1 cursor-text whitespace-pre-wrap break-words ${s.done ? 'text-muted-foreground line-through' : ''}`}
              >{trd}</span>
            )}
            {!editing && (
              <>
                <button onClick={() => startEdit(s)} title={t('editSubitem')} className="mt-0.5 shrink-0 text-xs text-muted-foreground hover:text-blue-500">✎</button>
                <button onClick={() => remove(s.id)} className="mt-0.5 shrink-0 text-xs text-muted-foreground hover:text-red-500">✕</button>
              </>
            )}
          </div>
        )
      })}
      <div className="flex gap-2">
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') add()
          }}
          placeholder={t('subitemPh')}
          className="h-7 text-xs"
        />
        <Button size="sm" onClick={add} disabled={!title.trim()}>{t('addSubitem')}</Button>
      </div>
    </div>
  )
}

function ReportsSection({
  t,
  locale,
  supabase,
  me,
  item,
  onMakeSubitem,
}: {
  t: T
  locale: string
  supabase: SB
  me: Me
  item: Item
  onMakeSubitem: (title: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [reports, setReports] = useState<Comment[]>([])
  const [count, setCount] = useState<number | null>(null)
  const [mode, setMode] = useState<'text' | 'link' | 'file'>('text')
  const [text, setText] = useState('')
  const [link, setLink] = useState('')
  const [uploading, setUploading] = useState(false)
  const loadedOnce = useRef(false)

  const tr = useAutoTranslate(reports.filter(r => r.kind === 'text').map(r => r.content), locale)

  useEffect(() => {
    ;(async () => {
      const { count: c } = await supabase.from('work_comments').select('id', { count: 'exact', head: true }).eq('item_id', item.id)
      setCount(c ?? 0)
    })()
  }, [supabase, item.id])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('work_comments')
      .select('id, author_id, author_name, content, kind, url, file_name, created_at')
      .eq('item_id', item.id)
      .order('created_at', { ascending: true })
    setReports((data ?? []) as Comment[])
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
      .channel(`work_reports_${item.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'work_comments', filter: `item_id=eq.${item.id}` }, payload => {
        const c = payload.new as Comment
        // 只在「真的新增了一列」時才 +1；自己送出的報告 insertReport 已樂觀更新過，
        // realtime 會再收到同一列，若無條件 +1 會重複計算。
        setReports(prev => {
          if (prev.some(x => x.id === c.id)) return prev
          setCount(cnt => (cnt ?? 0) + 1)
          return [...prev, c]
        })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [supabase, item.id, open])

  async function insertReport(payload: { content: string; kind: 'text' | 'link' | 'file'; url?: string; file_name?: string }) {
    const { data } = await supabase
      .from('work_comments')
      .insert({ item_id: item.id, owner_id: item.ownerId, author_name: me.name, ...payload })
      .select('id, author_id, author_name, content, kind, url, file_name, created_at')
      .single()
    if (data) {
      setReports(prev => (prev.some(x => x.id === data.id) ? prev : [...prev, data as Comment]))
      setCount(prev => (prev ?? 0) + 1)
    }
  }

  async function submit() {
    if (mode === 'text') {
      const c = text.trim()
      if (!c) return
      setText('')
      await insertReport({ content: c, kind: 'text' })
    } else if (mode === 'link') {
      const u = link.trim()
      if (!u) return
      setLink('')
      await insertReport({ content: u, kind: 'link', url: u })
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setUploading(true)
    try {
      const path = `${item.id}/${Date.now()}-${f.name}`
      const { error } = await supabase.storage.from('work-reports').upload(path, f)
      if (!error) {
        const { data: pub } = supabase.storage.from('work-reports').getPublicUrl(path)
        await insertReport({ content: f.name, kind: 'file', url: pub.publicUrl, file_name: f.name })
      }
    } finally {
      setUploading(false)
    }
  }

  // 報告文字 → 依行轉成多個子項目
  async function toSubitems(content: string) {
    const lines = content.split('\n').map(l => l.replace(/^[-*•\d.\s]+/, '').trim()).filter(Boolean)
    for (const l of lines) await onMakeSubitem(l)
  }

  async function deleteReport(id: string) {
    setReports(prev => prev.filter(r => r.id !== id))
    setCount(prev => Math.max(0, (prev ?? 1) - 1))
    await supabase.from('work_comments').delete().eq('id', id)
  }

  const isOwner = item.ownerId === me.id

  return (
    <div>
      <button onClick={() => setOpen(v => !v)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
        📋 {t('reportsTitle')}{count ? ` (${count})` : ''} {open ? '▲' : '▼'}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {reports.length === 0 && <p className="text-xs text-muted-foreground">{t('commentsEmpty')}</p>}
          {reports.map(r => {
            const translated = r.kind === 'text' ? tr(r.content) : r.content
            const showOriginal = r.kind === 'text' && translated.trim() !== r.content.trim()
            return (
              <div key={r.id} className="rounded-lg border bg-background p-2">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{r.author_name || t('authorFallback')}</span>
                  <span>{fmtTime(r.created_at)}</span>
                </div>
                {r.kind === 'link' && (
                  <a href={r.url ?? '#'} target="_blank" rel="noreferrer" className="mt-0.5 block break-all text-sm text-blue-600 underline">🔗 {r.content}</a>
                )}
                {r.kind === 'file' && (
                  <a href={r.url ?? '#'} target="_blank" rel="noreferrer" className="mt-0.5 block break-all text-sm text-blue-600 underline">📎 {r.file_name || r.content}</a>
                )}
                {r.kind === 'text' && (
                  <>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{translated}</p>
                    {showOriginal && <p className="mt-0.5 whitespace-pre-wrap text-[11px] text-muted-foreground">{r.content}</p>}
                  </>
                )}
                <div className="mt-1 flex items-center gap-3">
                  <button onClick={() => toSubitems(r.kind === 'text' ? r.content : r.file_name || r.content)} className="text-[11px] text-primary hover:underline">
                    ➕ {t('toSubitem')}
                  </button>
                  {(isOwner || r.author_id === me.id) && (
                    <button onClick={() => deleteReport(r.id)} className="text-[11px] text-muted-foreground hover:text-red-500">
                      🗑 {t('delete')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* 新增報告：文字／連結／檔案 */}
          <div className="flex gap-1">
            {(['text', 'link', 'file'] as const).map(m => (
              <Button key={m} size="sm" variant={mode === m ? 'default' : 'ghost'} onClick={() => setMode(m)}>
                {m === 'text' ? t('reportText') : m === 'link' ? t('reportLink') : t('reportFile')}
              </Button>
            ))}
          </div>

          {mode === 'text' && (
            <div className="flex items-end gap-2">
              <Textarea value={text} onChange={e => setText(e.target.value)} placeholder={t('reportTextPh')} rows={2} className="flex-1 text-sm" />
              <Button size="sm" onClick={submit} disabled={!text.trim()}>{t('send')}</Button>
            </div>
          )}
          {mode === 'link' && (
            <div className="flex items-center gap-2">
              <Input value={link} onChange={e => setLink(e.target.value)} placeholder={t('reportLinkPh')} className="h-8 flex-1 text-sm" />
              <Button size="sm" onClick={submit} disabled={!link.trim()}>{t('send')}</Button>
            </div>
          )}
          {mode === 'file' && (
            <div className="flex items-center gap-2">
              <input type="file" onChange={onFile} disabled={uploading} className="text-xs" />
              {uploading && <span className="text-xs text-muted-foreground">{t('uploading')}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
