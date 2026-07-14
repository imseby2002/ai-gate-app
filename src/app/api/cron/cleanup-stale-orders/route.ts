import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Vercel Cron: 清理逾時未付款的訂單暫存記錄（棄單）
// - credit_transactions：下單時先寫入 description='PENDING:...' 的佔位記錄，
//   ECPay 付款完成才轉正；棄單的佔位記錄（amount_usd=0）直接刪除
// - cs_plan_purchases：status='pending' 超過 STALE_HOURS → 標記 'expired'
//   （保留記錄供對帳，ecpay-return 只認 status='pending' 所以不會誤入帳）
const STALE_HOURS = 48

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    const isLocalhost = req.headers.get('host')?.startsWith('localhost')
    if (!isVercelCron && !isLocalhost) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - STALE_HOURS * 3600_000).toISOString()

  const { data: deletedTx, error: txError } = await supabase
    .from('credit_transactions')
    .delete()
    .like('description', 'PENDING:%')
    .eq('amount_usd', 0)
    .lt('created_at', cutoff)
    .select('id')

  const { data: expiredPurchases, error: purchaseError } = await supabase
    .from('cs_plan_purchases')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id')

  if (txError || purchaseError) {
    return NextResponse.json(
      { error: txError?.message ?? purchaseError?.message },
      { status: 500 },
    )
  }
  return NextResponse.json({
    deletedCreditPlaceholders: deletedTx?.length ?? 0,
    expiredPlanPurchases: expiredPurchases?.length ?? 0,
  })
}
