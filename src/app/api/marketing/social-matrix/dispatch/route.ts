import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSocialMatrix } from '@/lib/social-matrix/access'

export async function POST(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res

  const body = await req.json().catch(() => ({}))
  const { mode = 'copilot', group_name, copy_title, account_id, post_url } = body

  // 方案 B（矩陣無人值守自動發文）需瀏覽器自動化，主 app 不執行；尚未開放
  if (mode !== 'copilot') {
    return NextResponse.json({
      success: false,
      error: '方案 B（矩陣自動發文）尚未開放：系統目前不會自動登入社群帳號發文，請改用方案 A（Copilot）手動發布。',
    }, { status: 501 })
  }

  // 方案 A：使用者已手動發文，記錄一筆
  const supabase = await createClient()
  let accountId: string | null = account_id || null
  if (accountId) {
    const { data } = await supabase.from('marketing_social_accounts').select('id').eq('id', accountId).maybeSingle()
    accountId = data?.id ?? null
  }
  const { data: log, error } = await supabase.from('marketing_social_logs').insert({
    user_id: guard.user.id,
    account_id: accountId,
    action_type: 'post_mode_a',
    details: `【方案 A：真人 Copilot 發文】已發布至「${group_name || '目標社群'}」，文案版本：「${copy_title || '未命名文案'}」${post_url ? `，貼文連結：${post_url}` : ''}`,
    status: 'success',
  }).select().single()
  if (error) return NextResponse.json({ error: `記錄失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true, mode: 'copilot', message: '方案 A 發文已記錄', log })
}
