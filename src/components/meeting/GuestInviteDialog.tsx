'use client'

/** 主持人邀請訪客（免登入）：開關「允許訪客加入」、複製邀請連結、看已加入的訪客 */
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Copy, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function GuestInviteDialog({ meetingId, roomCode, onClose }: { meetingId: string; roomCode: string; onClose: () => void }) {
  const t = useTranslations('MeetingRoom')
  const [allow, setAllow] = useState<boolean | null>(null)
  const [guests, setGuests] = useState<{ id: string; name: string; created_at: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const link = typeof window !== 'undefined' ? `${window.location.origin}/mg/${roomCode}` : `/mg/${roomCode}`

  useEffect(() => {
    let alive = true
    const load = () => fetch(`/api/meeting/guests?meetingId=${meetingId}`).then(r => r.json()).then(j => {
      if (!alive) return
      setAllow(!!j.allow_guests); setGuests(j.guests ?? [])
    }).catch(() => {})
    void load()
    const timer = setInterval(load, 8000)
    return () => { alive = false; clearInterval(timer) }
  }, [meetingId])

  const toggle = async (next: boolean) => {
    setSaving(true)
    try {
      const res = await fetch('/api/meeting/guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meetingId, allow: next }) })
      if (res.ok) setAllow(next)
    } finally { setSaving(false) }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('inviteGuest')}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        {allow === null ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div> : (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allow} disabled={saving} onChange={e => toggle(e.target.checked)} />
              {t('allowGuests')}
            </label>
            <p className="text-xs text-gray-500">{t('allowGuestsHint')}</p>
            <div className={`flex gap-2 ${allow ? '' : 'opacity-50 pointer-events-none'}`}>
              <input readOnly value={link} className="flex-1 h-9 rounded-md border bg-gray-50 dark:bg-gray-800 px-2 text-sm" onFocus={e => e.target.select()} />
              <Button size="sm" onClick={copy} className="gap-1.5 h-9">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? t('copied') : t('copy')}</Button>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">{t('joinedGuests', { n: guests.length })}</div>
              {guests.length === 0 ? <p className="text-xs text-gray-400">{t('noGuests')}</p> : (
                <ul className="text-sm space-y-0.5 max-h-40 overflow-y-auto">
                  {guests.map(g => <li key={g.id}>{g.name} <span className="text-xs text-gray-400">{new Date(g.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></li>)}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
