import { NextRequest, NextResponse } from 'next/server'
import { microEsimClient } from '@/lib/esim/microesim'

export async function GET(req: NextRequest) {
  try {
    const [balanceInfo, notices] = await Promise.all([
      microEsimClient.getAccountBalance().catch(e => ({ balance: 0, currency: 'HKD', account: 'imseby', error: e.message })),
      microEsimClient.getDailyNotices().catch(() => []),
    ])

    return NextResponse.json({
      success: true,
      balance: balanceInfo,
      notices,
      checkedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || '無法取得 MicroEsim 狀態' },
      { status: 500 }
    )
  }
}
