/**
 * LINE 官方帳號群組推播
 * - 官方帳號被邀進群組（join）或在群組收到訊息時記錄群組；離開（leave）時標記
 * - 依排程以 Messaging API push（to = groupId）推播到群組
 * API：https://developers.line.biz/en/docs/messaging-api/group-chats/
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { companyMemberIds, getUserCompanyResources } from '@/lib/connector/company-resources'
import { loadChannelCredentials } from '@/lib/channels/resolve'

const LINE_API = 'https://api.line.me/v2/bot'

interface LineEvent {
  type?: string
  source?: { type?: string; groupId?: string }
}

async function groupSummary(token: string, groupId: string): Promise<{ name: string | null; picture: string | null }> {
  try {
    const res = await fetch(`${LINE_API}/group/${encodeURIComponent(groupId)}/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return { name: null, picture: null }
    const d = await res.json()
    return { name: d.groupName ?? null, picture: d.pictureUrl ?? null }
  } catch {
    return { name: null, picture: null }
  }
}

/** 客服 webhook 每個 LINE 事件呼叫：只處理群組來源的事件，失敗不影響客服流程 */
export async function trackLineGroupEvent(ownerId: string, token: string, event: LineEvent): Promise<void> {
  const groupId = event.source?.type === 'group' ? event.source.groupId : undefined
  if (!groupId) return
  const admin = createAdminClient()
  const now = new Date().toISOString()

  if (event.type === 'leave') {
    await admin.from('marketing_line_groups')
      .update({ status: 'left', left_at: now })
      .eq('user_id', ownerId).eq('group_id', groupId)
    return
  }

  const { data: existing } = await admin.from('marketing_line_groups')
    .select('id, name, status').eq('user_id', ownerId).eq('group_id', groupId).maybeSingle()

  if (existing && existing.status === 'active' && existing.name && event.type !== 'join') {
    await admin.from('marketing_line_groups').update({ last_seen_at: now }).eq('id', existing.id)
    return
  }

  const { name, picture } = token ? await groupSummary(token, groupId) : { name: null, picture: null }
  await admin.from('marketing_line_groups').upsert({
    user_id: ownerId,
    group_id: groupId,
    name: name ?? existing?.name ?? null,
    picture_url: picture,
    status: 'active',
    left_at: null,
    last_seen_at: now,
    ...(event.type === 'join' || !existing || existing.status === 'left' ? { joined_at: now } : {}),
  }, { onConflict: 'user_id,group_id' })
}

/** 目前使用者可用的官方帳號擁有者：本人＋同公司成員（webhook 記在官方帳號擁有者名下） */
export async function lineGroupOwnerIds(userId: string): Promise<string[]> {
  const company = await getUserCompanyResources(userId)
  const members = company ? await companyMemberIds(company.companyId) : []
  return [...new Set([userId, ...members])]
}

export interface PushResult { group_id: string; name: string | null; ok: boolean; error?: string }

/** 推播到單一群組：可附一張圖（https） */
export async function pushToLineGroup(token: string, groupId: string, text: string, imageUrl?: string | null): Promise<void> {
  const messages: Record<string, string>[] = []
  if (imageUrl) messages.push({ type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl })
  messages.push({ type: 'text', text: text.slice(0, 5000) })
  const res = await fetch(`${LINE_API}/message/push`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: groupId, messages }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? `LINE push 失敗 (HTTP ${res.status})`)
  }
}

/** 送出一筆排程貼文（cron 或「立即發送」呼叫）；以狀態條件原子領取，避免重複送 */
export async function sendLineGroupPost(postId: string): Promise<{ status: string; results: PushResult[] } | null> {
  const admin = createAdminClient()
  const { data: post } = await admin.from('marketing_line_group_posts')
    .update({ status: 'sending' })
    .eq('id', postId).eq('status', 'scheduled')
    .select('id, group_ids, text, image_url')
    .maybeSingle()
  if (!post) return null

  const { data: groups } = await admin.from('marketing_line_groups')
    .select('id, user_id, group_id, name, status').in('id', post.group_ids as string[])

  const tokens = new Map<string, string>()
  const results: PushResult[] = []
  for (const g of groups ?? []) {
    if (g.status !== 'active') { results.push({ group_id: g.group_id, name: g.name, ok: false, error: '官方帳號已不在此群組' }); continue }
    try {
      if (!tokens.has(g.user_id)) tokens.set(g.user_id, (await loadChannelCredentials(g.user_id, 'line', 'cs')).line_channel_access_token ?? '')
      const token = tokens.get(g.user_id)
      if (!token) throw new Error('未設定 LINE Channel Access Token')
      await pushToLineGroup(token, g.group_id, post.text as string, post.image_url as string | null)
      results.push({ group_id: g.group_id, name: g.name, ok: true })
    } catch (e) {
      results.push({ group_id: g.group_id, name: g.name, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  const okCount = results.filter(r => r.ok).length
  const status = okCount === 0 ? 'failed' : okCount === results.length ? 'sent' : 'partial'
  await admin.from('marketing_line_group_posts')
    .update({ status, results, sent_at: new Date().toISOString() })
    .eq('id', post.id)
  return { status, results }
}
