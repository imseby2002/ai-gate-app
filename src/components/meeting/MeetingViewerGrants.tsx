'use client'

/** 會議紀錄瀏覽授權：授權同事瀏覽「我主持的所有會議」；也列出誰授權給我 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, Loader2, Plus, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Grant { id: string; user_id: string; name: string; created_at: string }
interface Candidate { user_id: string; name: string; role: string }

export function MeetingViewerGrants() {
  const t = useTranslations('MeetingRoom')
  const [granted, setGranted] = useState<Grant[]>([])
  const [toMe, setToMe] = useState<Grant[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/meeting/viewers')
    if (!res.ok) return
    const j = await res.json()
    setGranted(j.granted ?? []); setToMe(j.grantedToMe ?? []); setCandidates(j.candidates ?? []); setLoaded(true)
  }, [])
  useEffect(() => { void load() }, [load])

  const add = async () => {
    if (!pick) return
    setBusy(true)
    try {
      const res = await fetch('/api/meeting/viewers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ viewerId: pick }) })
      if (res.ok) { setPick(''); await load() }
    } finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setBusy(true)
    try { await fetch('/api/meeting/viewers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); await load() }
    finally { setBusy(false) }
  }

  const available = candidates.filter(c => !granted.some(g => g.user_id === c.user_id))
  return (
    <Card className="space-y-3 p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium"><Eye className="h-4 w-4" />{t('viewerTitle')}</p>
      <p className="text-xs text-muted-foreground">{t('viewerHint')}</p>
      {!loaded ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : (
        <>
          <div className="flex gap-2">
            <select value={pick} onChange={e => setPick(e.target.value)} className="h-9 flex-1 rounded-md border bg-background px-2 text-sm">
              <option value="">{t('viewerPick')}</option>
              {available.map(c => <option key={c.user_id} value={c.user_id}>{c.name}{c.role === 'owner' || c.role === 'admin' ? `（${t('viewerAdminTag')}）` : ''}</option>)}
            </select>
            <Button size="sm" onClick={add} disabled={!pick || busy} className="h-9 gap-1.5"><Plus className="h-4 w-4" />{t('viewerGrant')}</Button>
          </div>
          {granted.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {granted.map(g => (
                <span key={g.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                  {g.name}
                  <button onClick={() => remove(g.id)} disabled={busy} title={t('viewerRevoke')}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          {toMe.length > 0 && <p className="text-xs text-muted-foreground">{t('viewerToMe', { names: toMe.map(g => g.name).join('、') })}</p>}
        </>
      )}
    </Card>
  )
}
