import { NextRequest, NextResponse } from 'next/server'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { StorageService } from '@/lib/social-matrix/storage'

export async function POST(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const authUser = guard.user

  try {
    const body = await req.json()
    const {
      mode = 'copilot', // 'copilot' (方案A) | 'matrix_auto' (方案B)
      group_name,
      platform = 'facebook',
      copy_id,
      copy_title,
      account_id,
      post_url,
    } = body

    const accounts = StorageService.getAccounts()
    const targetAccount = accounts.find(a => a.id === account_id) || accounts[0]

    if (mode === 'copilot') {
      // Mode A: Copilot manual confirmation & record
      const log = StorageService.addLog({
        account_id: targetAccount.id,
        account_name: targetAccount.account_name,
        platform: platform,
        action_type: 'post_mode_a',
        details: `【方案 A：真人 Copilot 發文】已發布至「${group_name || '目標社群'}」，文案版本：「${copy_title || '防封文案'}」${post_url ? `，貼文連結：${post_url}` : ''}`,
        status: 'success',
      })

      return NextResponse.json({
        success: true,
        mode: 'copilot',
        message: '方案 A 發文已記錄成功！真實帳號權重保持安全無虞',
        log,
      })
    } else {
      // Mode B: Matrix Auto Queue execution
      // Check mature accounts
      const matureAccounts = accounts.filter(a => a.status === 'mature' || a.warmup_day >= 12)
      if (matureAccounts.length === 0) {
        return NextResponse.json({
          success: false,
          error: '目前尚無達到 Day 12+ 成熟期的帳號，為避免新號遭演算法風控，請先完成 14 天擬人化養號或改用方案 A！',
        }, { status: 400 })
      }

      // Simulate staggered dispatch queue
      const dispatched = []
      for (let i = 0; i < matureAccounts.length; i++) {
        const acc = matureAccounts[i]
        const delayMinutes = (i + 1) * 35 + Math.floor(Math.random() * 20)
        const log = StorageService.addLog({
          account_id: acc.id,
          account_name: acc.account_name,
          platform: acc.platform,
          action_type: 'post_mode_b',
          details: `【方案 B：矩陣無人值守排程】已排入分批佇列（預計 +${delayMinutes} 分鐘後透過綁定代理 ${acc.proxy?.host || '獨立IP'} 獨立指派發布），文案變異碼：#${copy_id || 'matrix_var'}`,
          status: 'success',
        })
        dispatched.push({
          account_id: acc.id,
          account_name: acc.account_name,
          scheduled_in_minutes: delayMinutes,
          proxy_host: acc.proxy?.host || 'Native-Residential-IP',
          status: 'queued',
        })
      }

      return NextResponse.json({
        success: true,
        mode: 'matrix_auto',
        message: `方案 B 排程成功！已安全指派至 ${matureAccounts.length} 個成熟矩陣號，獨立 IP 隔離防封分批發送中`,
        dispatched,
      })
    }
  } catch (err) {
    return NextResponse.json({ error: `發布操作失敗: ${String(err)}` }, { status: 500 })
  }
}
