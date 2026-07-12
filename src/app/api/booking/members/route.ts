import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// 成員的邀請／修改／移除已統一走 /api/collab/members（含方案協作者上限檢查），
// 這裡只保留 GET 供 BnbSwitcher 顯示「我管理的民宿／我參與的民宿」。
// 舊的 POST/PATCH/DELETE 已移除：它們沒有方案人數檢查，直接打 API 可繞過協作者上限。

async function profileMap(ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (uniq.length === 0) return {} as Record<string, { email: string | null; full_name: string | null }>
  const admin = await createAdminClient()
  const { data } = await admin.from('profiles').select('id, email, full_name').in('id', uniq)
  const map: Record<string, { email: string | null; full_name: string | null }> = {}
  for (const p of data ?? []) map[p.id] = { email: p.email, full_name: p.full_name }
  return map
}

// 列出我邀請的成員 + 我被邀請參與的民宿
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 自動接受 email 相符的待處理邀請
  await supabase.rpc('claim_bnb_invitations')

  const [{ data: managing }, { data: memberships }] = await Promise.all([
    supabase.from('bnb_members').select('*').eq('owner_id', user.id).order('created_at', { ascending: true }),
    supabase.from('bnb_members').select('*').eq('member_id', user.id).eq('status', 'active'),
  ])

  const ids = [
    ...(managing ?? []).map((m) => m.member_id).filter(Boolean),
    ...(memberships ?? []).map((m) => m.owner_id),
  ] as string[]
  const profiles = await profileMap(ids)

  return NextResponse.json({
    self: { id: user.id, email: user.email },
    managing: (managing ?? []).map((m) => ({
      ...m,
      token: undefined,
      member: m.member_id ? profiles[m.member_id] ?? null : null,
    })),
    memberships: (memberships ?? []).map((m) => ({
      owner_id: m.owner_id,
      role: m.role,
      owner: profiles[m.owner_id] ?? null,
    })),
  })
}
