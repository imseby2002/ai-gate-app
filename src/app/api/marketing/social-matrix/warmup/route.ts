import { NextRequest, NextResponse } from 'next/server'
import { getCronOrUserAuth } from '@/lib/cron-auth'
import { StorageService } from '@/lib/social-matrix/storage'

export async function GET(req: NextRequest) {
  const authUser = await getCronOrUserAuth(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const logs = StorageService.getLogs()
  return NextResponse.json({ logs })
}

export async function POST(req: NextRequest) {
  const authUser = await getCronOrUserAuth(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { account_id, run_all } = await req.json()
    const allAccounts = StorageService.getAccounts()

    const targetAccounts = run_all
      ? allAccounts.filter(a => a.status === 'warming' || a.status === 'mature')
      : allAccounts.filter(a => a.id === account_id)

    if (targetAccounts.length === 0) {
      return NextResponse.json({ error: '找不到指定執行養號的帳號' }, { status: 400 })
    }

    const results = []
    for (const acc of targetAccounts) {
      const outcome = StorageService.runWarmupForAccount(acc)
      results.push({
        account_id: acc.id,
        account_name: acc.account_name,
        platform: acc.platform,
        ...outcome,
      })
    }

    return NextResponse.json({
      success: true,
      processed_count: results.length,
      results,
      updated_accounts: StorageService.getAccounts(),
      latest_logs: StorageService.getLogs(),
    })
  } catch (err) {
    return NextResponse.json({ error: `養號執行失敗: ${String(err)}` }, { status: 500 })
  }
}
