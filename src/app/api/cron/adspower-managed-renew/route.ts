import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renewExpiredManaged } from '@/lib/connector/managed-billing'
import { renewExpiredCompanyManaged } from '@/lib/connector/company-resources'

// Vercel Cron：每日處理到期的 AdsPower 代管（個人＋公司共享）——點數足夠自動續扣，不足或關閉自動續費則暫停。
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    const isLocalhost = req.headers.get('host')?.startsWith('localhost')
    if (!isVercelCron && !isLocalhost) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const personal = await renewExpiredManaged(admin)
  const company = await renewExpiredCompanyManaged(admin)
  return NextResponse.json({ ok: true, personal, company })
}
