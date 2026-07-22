// Google Calendar / Gmail OAuth + API helper。
// 沿用 src/lib/google-drive.ts 的 OAuth token 交換/刷新邏輯（同一組 GOOGLE_CLIENT_ID/SECRET
// 底下不同 scope 的獨立授權，互不影響 Drive 既有的連結），只是另外走一組 scope 更廣的同意畫面，
// 存進 user_integrations 的 provider='google_calendar'（與 'google_drive' 分開存，各自能單獨連結/取消）。
export { exchangeCode, refreshAccessToken } from './google-drive'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1'

export function getCalendarOAuthUrl(redirectUri: string, state?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID 未設定，請於 Google Cloud Console 建立 OAuth 2.0 用戶端 ID 並設定環境變數')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly email profile',
    access_type: 'offline',
    prompt: 'select_account consent',
    ...(state ? { state } : {}),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function getCalendarUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  return data.email ?? ''
}

export interface CalendarEvent {
  id?: string
  summary: string
  description?: string
  start: string   // ISO datetime
  end: string      // ISO datetime
  location?: string
}

export async function listUpcomingEvents(accessToken: string, maxResults = 10): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  })
  const res = await fetch(`${CALENDAR_API}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? 'Google Calendar 讀取失敗')
  return (data.items ?? []).map((e: Record<string, unknown>) => {
    const start = e.start as Record<string, string> | undefined
    const end = e.end as Record<string, string> | undefined
    return {
      id: e.id as string,
      summary: (e.summary as string) ?? '（無標題）',
      description: e.description as string | undefined,
      start: start?.dateTime ?? start?.date ?? '',
      end: end?.dateTime ?? end?.date ?? '',
      location: e.location as string | undefined,
    }
  })
}

export async function createCalendarEvent(accessToken: string, event: CalendarEvent): Promise<{ id: string; htmlLink: string }> {
  const res = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: { dateTime: event.start },
      end: { dateTime: event.end },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? 'Google Calendar 建立事件失敗')
  return { id: data.id, htmlLink: data.htmlLink }
}

export interface GmailSummary {
  id: string
  from: string
  subject: string
  snippet: string
  date: string
}

export async function listRecentImportantEmails(accessToken: string, maxResults = 10): Promise<GmailSummary[]> {
  const listParams = new URLSearchParams({
    maxResults: String(maxResults),
    q: 'is:unread -category:promotions -category:social',
  })
  const listRes = await fetch(`${GMAIL_API}/users/me/messages?${listParams}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const listData = await listRes.json()
  if (!listRes.ok) throw new Error(listData?.error?.message ?? 'Gmail 讀取失敗')
  const ids: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id)

  const summaries: GmailSummary[] = []
  for (const id of ids) {
    const msgRes = await fetch(
      `${GMAIL_API}/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const msg = await msgRes.json()
    if (!msgRes.ok) continue
    const headers: { name: string; value: string }[] = msg.payload?.headers ?? []
    const get = (name: string) => headers.find(h => h.name === name)?.value ?? ''
    summaries.push({
      id,
      from: get('From'),
      subject: get('Subject'),
      snippet: msg.snippet ?? '',
      date: get('Date'),
    })
  }
  return summaries
}
