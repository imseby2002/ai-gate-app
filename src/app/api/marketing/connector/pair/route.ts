// POST /api/marketing/connector/pair — 網頁端產生 10 分鐘有效的配對碼，貼到桌面連接器完成配對
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { generatePairCode, sha256, PAIR_CODE_TTL_MINUTES } from '@/lib/connector/auth'

export async function POST(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  if (guard.user.isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const code = generatePairCode()
  const expiresAt = new Date(Date.now() + PAIR_CODE_TTL_MINUTES * 60 * 1000).toISOString()
  const { error } = await createAdminClient().from('marketing_connector_pair_codes').insert({
    user_id: guard.user.id,
    code_hash: sha256(code),
    expires_at: expiresAt,
  })
  if (error) return NextResponse.json({ error: `產生配對碼失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ code, expires_at: expiresAt })
}
