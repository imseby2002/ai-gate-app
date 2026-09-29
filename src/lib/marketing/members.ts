// 「會員數」KPI 的兩個資料來源：
//   1. LINE 官方帳號好友數 — LINE Messaging API GET /v2/bot/insight/followers（即時讀取，不落表）
//      https://developers.line.biz/en/reference/messaging-api/#get-number-of-followers
//      date 以 UTC+9 計、只能查到「昨天」為止；status=ready 才有數字
//   2. 官網會員 — 公開加入頁 /join/[key] 寫入 site_members
import { createAdminClient } from '@/lib/supabase/admin'
import type { CredentialRow } from '@/lib/marketing/publish'

type Admin = ReturnType<typeof createAdminClient>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 加入頁網址的 key：有民宿官網 slug 用 slug，否則用 owner id */
export async function memberJoinKey(admin: Admin, ownerId: string): Promise<string> {
  const { data } = await admin.from('bnb_profiles').select('slug').eq('user_id', ownerId).not('slug', 'is', null).limit(1).maybeSingle()
  return (data?.slug as string | undefined) || ownerId
}

export function memberJoinUrl(key: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/join/${encodeURIComponent(key)}`
}

/** 加入頁 key → owner id 與顯示名稱；查無回 null */
export async function resolveJoinKey(admin: Admin, key: string): Promise<{ ownerId: string; name: string } | null> {
  const { data: bnb } = await admin.from('bnb_profiles').select('user_id, name').eq('slug', key).maybeSingle()
  if (bnb?.user_id) return { ownerId: bnb.user_id as string, name: (bnb.name as string) || '' }
  if (!UUID_RE.test(key)) return null
  const { data: profile } = await admin.from('profiles').select('id').eq('id', key).maybeSingle()
  if (!profile) return null
  const { data: brand } = await admin.from('mkt_brand').select('name').eq('owner_id', key).maybeSingle()
  return { ownerId: key, name: (brand?.name as string | undefined) || '' }
}

// UTC+9 的「昨天」，格式 yyyyMMdd
function lineInsightDate(): string {
  const d = new Date(Date.now() + 9 * 3600_000 - 86400_000)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

export interface LineFollowers { date: string; status: string; followers: number | null; targetedReaches: number | null; blocks: number | null }

/** 優先用客服頻道綁定的 LINE（platform='line'），其次行銷的 LINE VOOM；兩者都是 Channel Access Token */
export function lineTokenFrom(rows: CredentialRow[]): string | null {
  const cs = rows.find(r => r.platform === 'line' && r.is_connected)?.credentials?.line_channel_access_token
  const voom = rows.find(r => r.platform === 'LINE VOOM' && r.is_connected)?.credentials?.channel_access_token
  return cs || voom || null
}

export async function getLineFollowers(token: string): Promise<LineFollowers> {
  const date = lineInsightDate()
  const res = await fetch(`https://api.line.me/v2/bot/insight/followers?date=${date}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json() as { status?: string; followers?: number; targetedReaches?: number; blocks?: number; message?: string }
  if (!res.ok) throw new Error(`LINE 好友數讀取失敗：${data.message ?? res.status}`)
  return {
    date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
    status: data.status ?? 'unknown',
    followers: data.followers ?? null,
    targetedReaches: data.targetedReaches ?? null,
    blocks: data.blocks ?? null,
  }
}

export interface SiteMemberCounts { total: number; newInRange: number; since: string | null; bySource: Record<string, number> }

export async function getSiteMemberCounts(admin: Admin, ownerId: string, since?: string): Promise<SiteMemberCounts> {
  const [{ count: total }, recent] = await Promise.all([
    admin.from('site_members').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    since
      ? admin.from('site_members').select('source').eq('owner_id', ownerId).gte('created_at', since).limit(5000)
      : Promise.resolve({ data: [] as { source: string | null }[] }),
  ])
  const bySource: Record<string, number> = {}
  for (const r of (recent.data ?? []) as { source: string | null }[]) {
    const k = r.source || 'direct'
    bySource[k] = (bySource[k] ?? 0) + 1
  }
  return { total: total ?? 0, newInRange: (recent.data ?? []).length, since: since ?? null, bySource }
}
