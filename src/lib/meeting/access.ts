/**
 * 會議存取身分：登入成員（主持人／參與者）或訪客（免登入，例如面試者）。
 * 訪客 token 由伺服器以 HMAC 簽發，放在 header `x-meeting-guest`。
 */
import crypto from 'crypto'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const GUEST_HEADER = 'x-meeting-guest'
const TTL_SEC = 12 * 60 * 60

function secret() {
  return process.env.MEETING_GUEST_SECRET || crypto.createHash('sha256').update(`meeting-guest:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`).digest('hex')
}
const b64u = (s: string | Buffer) => Buffer.from(s).toString('base64url')

export interface GuestClaims { m: string; g: string; n: string; exp: number }

export function signGuestToken(c: Omit<GuestClaims, 'exp'>): string {
  const body = b64u(JSON.stringify({ ...c, exp: Math.floor(Date.now() / 1000) + TTL_SEC }))
  const sig = b64u(crypto.createHmac('sha256', secret()).update(body).digest())
  return `${body}.${sig}`
}

export function verifyGuestToken(token: string | null | undefined): GuestClaims | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expect = b64u(crypto.createHmac('sha256', secret()).update(body).digest())
  const a = Buffer.from(sig), b = Buffer.from(expect)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const c = JSON.parse(Buffer.from(body, 'base64url').toString()) as GuestClaims
    if (!c.m || !c.g || c.exp < Math.floor(Date.now() / 1000)) return null
    return c
  } catch { return null }
}

export interface MeetingActor {
  kind: 'user' | 'guest'
  id: string
  name: string
  isHost: boolean
  meeting: { id: string; host_id: string; room_code: string; title: string; is_active: boolean; allow_guests: boolean }
}

/** 解析呼叫者對這場會議的身分；無權限回 null */
export async function resolveMeetingActor(req: NextRequest, meetingId: string): Promise<MeetingActor | null> {
  if (!meetingId) return null
  const admin = createAdminClient()
  const { data: meeting } = await admin.from('meetings')
    .select('id, host_id, room_code, title, is_active, allow_guests').eq('id', meetingId).maybeSingle()
  if (!meeting) return null

  const guest = verifyGuestToken(req.headers.get(GUEST_HEADER))
  if (guest) {
    if (guest.m !== meetingId || !meeting.allow_guests || !meeting.is_active) return null
    return { kind: 'guest', id: guest.g, name: guest.n, isHost: false, meeting }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const isHost = meeting.host_id === user.id
  if (!isHost) {
    const { data: p } = await admin.from('meeting_participants').select('id').eq('meeting_id', meetingId).eq('user_id', user.id).maybeSingle()
    if (!p) return null
  }
  const { data: profile } = await admin.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle()
  return { kind: 'user', id: user.id, name: profile?.full_name || profile?.email || user.email || 'member', isHost, meeting }
}
