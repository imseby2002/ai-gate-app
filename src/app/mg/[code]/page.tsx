'use client'

/** 會議訪客頁（免登入，例如面試者）：輸入姓名加入 → 視訊＋文字聊天＋傳檔 */
import { use, useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Video, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { MeetingVideo } from '@/components/meeting/MeetingVideo'
import { MeetingChat } from '@/components/meeting/MeetingChat'

interface Session { token: string; guest: { id: string; name: string }; meeting: { id: string; title: string; room_code: string } }

export default function MeetingGuestPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params)
  const code = decodeURIComponent(rawCode).toUpperCase()
  const t = useTranslations('MeetingRoom')
  const locale = useLocale()
  const key = `meeting-guest:${code}`
  const [session, setSession] = useState<Session | null>(null)
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [err, setErr] = useState('')
  const [video, setVideo] = useState(false)

  useEffect(() => {
    try { const s = sessionStorage.getItem(key); if (s) setSession(JSON.parse(s)) } catch {}
    try { const n = localStorage.getItem('meeting-guest-name'); if (n) setName(n) } catch {}
  }, [key])

  const join = async () => {
    if (!name.trim() || joining) return
    setJoining(true); setErr('')
    try {
      const res = await fetch('/api/meeting/guest/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name }),
      })
      const j = await res.json()
      if (!res.ok) {
        setErr(j.error === 'guests_closed' ? t('guestsClosed') : j.error === 'not_found' ? t('meetingNotFound') : t('joinFailed'))
        return
      }
      try { sessionStorage.setItem(key, JSON.stringify(j)); localStorage.setItem('meeting-guest-name', name.trim()) } catch {}
      setSession(j)
    } finally { setJoining(false) }
  }

  const leave = () => { try { sessionStorage.removeItem(key) } catch {}; setVideo(false); setSession(null) }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="font-semibold text-sm">{session ? session.meeting.title : t('guestTitle')}</div>
        <LanguageSwitcher currentLocale={locale} />
      </header>
      <main className="mx-auto max-w-5xl p-4 space-y-4">
        {!session ? (
          <Card className="mx-auto max-w-md p-6 space-y-4">
            <div>
              <h1 className="text-lg font-semibold">{t('guestTitle')}</h1>
              <p className="text-sm text-gray-500">{t('guestIntro', { code })}</p>
            </div>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('guestNamePlaceholder')} maxLength={60}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void join() }} />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <Button onClick={join} disabled={joining || !name.trim()} className="w-full gap-1.5">
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}{t('guestJoin')}
            </Button>
            <p className="text-xs text-gray-400">{t('guestPrivacy')}</p>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-500">{t('joinedAs', { name: session.guest.name })}</span>
              {!video && <Button size="sm" onClick={() => setVideo(true)} className="gap-1.5"><Video className="h-4 w-4" />{t('videoStart')}</Button>}
              <Button size="sm" variant="outline" onClick={leave} className="ml-auto">{t('leave')}</Button>
            </div>
            <div className={`grid gap-4 ${video ? 'lg:grid-cols-[1fr_360px]' : ''}`}>
              {video && (
                <MeetingVideo meetingId={session.meeting.id} selfId={`g-${session.guest.id}`} selfName={session.guest.name}
                  authHeaders={{ 'x-meeting-guest': session.token }} onClose={() => setVideo(false)} />
              )}
              <MeetingChat meetingId={session.meeting.id} authHeaders={{ 'x-meeting-guest': session.token }} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
