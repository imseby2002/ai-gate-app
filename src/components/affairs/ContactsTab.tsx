'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, Loader2, Phone, Mail, MessageCircle, Star, CalendarClock, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CONTACT_CATEGORIES, CONTACT_ORG_TYPES, LOG_KINDS } from '@/lib/affairs/records'
import { Chips, Field, Modal, selectCls, textareaCls, useRecords, todayStr, type Row } from './shared'

export function ContactsTab() {
  const t = useTranslations('AffairsX')
  const contacts = useRecords<Row>('contacts')
  const [cat, setCat] = useState<'all' | (typeof CONTACT_CATEGORIES)[number]>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Partial<Row> | null>(null)
  const today = todayStr()

  const list = contacts.items
    .filter(c => cat === 'all' || c.category === cat)
    .filter(c => !q || [c.name, c.organization, c.title, c.region, c.traits, c.notes].join(' ').toLowerCase().includes(q.toLowerCase()))
  const due = contacts.items.filter(c => c.next_followup && c.next_followup <= today)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <Chips value={cat} onChange={setCat} options={[['all', t('all')], ...CONTACT_CATEGORIES.map(c => [c, t(`ccat.${c}`)] as [typeof c, string])]} />
        <div className="flex gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8 w-48" value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchPh')} />
          </div>
          <Button size="sm" className="gap-1" onClick={() => setEditing({ category: cat === 'all' ? 'landlord' : cat, importance: 3 })}>
            <Plus className="h-4 w-4" />{t('newContact')}
          </Button>
        </div>
      </div>

      {due.length > 0 && (
        <Card className="p-3 border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-sm">
          <div className="font-semibold flex items-center gap-1 mb-1"><CalendarClock className="h-4 w-4" />{t('followupDue', { n: due.length })}</div>
          <div className="flex flex-wrap gap-2">
            {due.map(c => <button key={c.id} onClick={() => setEditing(c)} className="underline text-xs">{c.name}（{c.next_followup}）</button>)}
          </div>
        </Card>
      )}

      {contacts.loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : list.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{t('noContacts')}</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map(c => (
            <Card key={c.id} className="p-4 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{c.name}{c.title ? <span className="font-normal text-muted-foreground"> · {c.title}</span> : null}</div>
                  <div className="text-xs text-muted-foreground">
                    {t(`ccat.${c.category}`)}{c.org_type ? ` · ${t(`org.${c.org_type}`)}` : ''}{c.organization ? ` · ${c.organization}` : ''}{c.region ? ` · ${c.region}` : ''}
                  </div>
                </div>
                <div className="flex">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < c.importance ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />)}</div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                {c.im && <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{c.im}</span>}
              </div>
              {c.traits && <p className="text-xs line-clamp-2">{c.traits}</p>}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {t('lastContact')}: {c.last_contact_at ?? '—'}
                  {c.next_followup && <span className={c.next_followup <= today ? 'text-red-600 font-medium' : ''}> · {t('nextFollowup')}: {c.next_followup}</span>}
                </span>
                <span className="flex">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => { if (confirm(t('confirmDelete'))) contacts.remove(c.id) }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <ContactModal contact={editing} onClose={() => { setEditing(null); contacts.reload() }}
        onSave={async row => { const err = await contacts.save(row); if (!err && !row.id) setEditing(null); return err }} />}
    </div>
  )
}

function ContactModal({ contact, onClose, onSave }: { contact: Partial<Row>; onClose: () => void; onSave: (r: Partial<Row>) => Promise<string | null> }) {
  const t = useTranslations('AffairsX')
  const [f, setF] = useState<Partial<Row>>(contact)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (k: string, v: unknown) => setF(p => ({ ...p, [k]: v }))
  const orgTypes = CONTACT_ORG_TYPES[f.category ?? 'other'] ?? []

  const submit = async () => {
    setBusy(true)
    const e = await onSave(f)
    setBusy(false)
    setMsg(e ?? t('saved'))
  }

  return (
    <Modal title={f.id ? t('editContact') : t('newContact')} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('f.category')}>
          <select className={selectCls} value={f.category ?? 'landlord'} onChange={e => setF(p => ({ ...p, category: e.target.value, org_type: '' }))}>
            {CONTACT_CATEGORIES.map(c => <option key={c} value={c}>{t(`ccat.${c}`)}</option>)}
          </select>
        </Field>
        {orgTypes.length > 0 && (
          <Field label={t('f.orgType')}>
            <select className={selectCls} value={f.org_type ?? ''} onChange={e => set('org_type', e.target.value)}>
              <option value="">—</option>
              {orgTypes.map(o => <option key={o} value={o}>{t(`org.${o}`)}</option>)}
            </select>
          </Field>
        )}
        <Field label={t('f.importance')}>
          <select className={selectCls} value={f.importance ?? 3} onChange={e => set('importance', e.target.value)}>
            {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
          </select>
        </Field>
        <Field label={t('f.contactName')}><Input value={f.name ?? ''} onChange={e => set('name', e.target.value)} /></Field>
        <Field label={t('f.title')}><Input value={f.title ?? ''} onChange={e => set('title', e.target.value)} /></Field>
        <Field label={t('f.organization')}><Input value={f.organization ?? ''} onChange={e => set('organization', e.target.value)} /></Field>
        <Field label={t('f.phone')}><Input value={f.phone ?? ''} onChange={e => set('phone', e.target.value)} /></Field>
        <Field label={t('f.email')}><Input value={f.email ?? ''} onChange={e => set('email', e.target.value)} /></Field>
        <Field label={t('f.im')}><Input value={f.im ?? ''} onChange={e => set('im', e.target.value)} placeholder="LINE / Zalo / WeChat" /></Field>
        <Field label={t('f.region')}><Input value={f.region ?? ''} onChange={e => set('region', e.target.value)} /></Field>
        <Field label={t('f.nextFollowup')}><Input type="date" value={f.next_followup ?? ''} onChange={e => set('next_followup', e.target.value)} /></Field>
        <Field label={t('f.storeCode')}><Input value={f.store_code ?? ''} onChange={e => set('store_code', e.target.value)} /></Field>
      </div>
      <Field label={t('f.traits')}><textarea className={textareaCls} value={f.traits ?? ''} onChange={e => set('traits', e.target.value)} placeholder={t('traitsPh')} /></Field>
      <Field label={t('f.notes')}><textarea className={textareaCls} value={f.notes ?? ''} onChange={e => set('notes', e.target.value)} /></Field>
      <div className="flex items-center justify-end gap-2">
        {msg && <span className="text-sm text-muted-foreground mr-auto">{msg}</span>}
        <Button variant="outline" onClick={onClose}>{t('close')}</Button>
        <Button onClick={submit} disabled={busy || !f.name}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}{t('save')}</Button>
      </div>
      {f.id && <ContactLogs contactId={f.id} />}
    </Modal>
  )
}

function ContactLogs({ contactId }: { contactId: string }) {
  const t = useTranslations('AffairsX')
  const logs = useRecords<Row>('logs', `contact_id=${contactId}`)
  const [f, setF] = useState({ log_date: todayStr(), kind: 'visit', summary: '', next_action: '' })
  const [busy, setBusy] = useState(false)

  const add = async () => {
    setBusy(true)
    const err = await logs.save({ ...f, contact_id: contactId })
    setBusy(false)
    if (!err) setF({ log_date: todayStr(), kind: 'visit', summary: '', next_action: '' })
  }

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="text-sm font-semibold">{t('logsTitle')}</div>
      <div className="grid gap-2 sm:grid-cols-[140px_130px_1fr]">
        <Input type="date" value={f.log_date} onChange={e => setF({ ...f, log_date: e.target.value })} />
        <select className={selectCls} value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>
          {LOG_KINDS.map(k => <option key={k} value={k}>{t(`log.${k}`)}</option>)}
        </select>
        <Input value={f.summary} onChange={e => setF({ ...f, summary: e.target.value })} placeholder={t('logSummaryPh')} />
      </div>
      <div className="flex gap-2">
        <Input value={f.next_action} onChange={e => setF({ ...f, next_action: e.target.value })} placeholder={t('logNextPh')} />
        <Button size="sm" onClick={add} disabled={busy || !f.summary}>{t('addLog')}</Button>
      </div>
      <div className="space-y-2">
        {logs.items.map(l => (
          <div key={l.id} className="flex items-start gap-2 text-sm rounded-md bg-muted/40 p-2">
            <span className="text-xs text-muted-foreground w-20 shrink-0">{l.log_date}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-background border shrink-0">{t(`log.${l.kind}`)}</span>
            <div className="flex-1 min-w-0">
              <div>{l.summary}</div>
              {l.next_action && <div className="text-xs text-muted-foreground">→ {l.next_action}</div>}
            </div>
            <button className="text-muted-foreground hover:text-red-600" onClick={() => logs.remove(l.id)}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
