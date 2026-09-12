import { NextRequest, NextResponse } from 'next/server'
import { verifyCheckMac, getEcpayConfig } from '@/lib/ecpay/client'
import { updateEsimOrder } from '@/lib/esim/db'
import { fulfillEsimOrder } from '@/lib/esim/fulfillment'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const params: Record<string, string> = {}
    for (const [k, v] of new URLSearchParams(body)) {
      params[k] = v
    }

    const config = getEcpayConfig()

    // 驗證綠界 CheckMacValue
    const isValidMac = await verifyCheckMac(params, config.hashKey, config.hashIV)
    if (!isValidMac) {
      console.error('[ECPay eSIM] CheckMacValue validation failed', params)
      return new NextResponse('0|CheckMacValue Error', { status: 200 })
    }

    const { RtnCode, MerchantTradeNo, TradeNo } = params

    if (RtnCode === '1') {
      console.log(`[ECPay eSIM] Payment successful for order ${MerchantTradeNo}, TradeNo: ${TradeNo}`)
      await updateEsimOrder(MerchantTradeNo, {
        payment_status: 'paid',
        payment_trade_no: TradeNo,
        paid_at: new Date().toISOString(),
      })

      // 觸發 MicroEsim 發卡
      fulfillEsimOrder(MerchantTradeNo).catch(err => {
        console.error('[ECPay eSIM] Async fulfillment error:', err)
      })
    } else {
      console.warn(`[ECPay eSIM] Payment failed or cancelled for order ${MerchantTradeNo}`, { RtnCode })
      await updateEsimOrder(MerchantTradeNo, {
        payment_status: 'failed',
        error_message: `綠界付款失敗代碼: ${RtnCode}`,
      })
    }

    // 綠界規定必須回傳 1|OK
    return new NextResponse('1|OK', { status: 200 })
  } catch (err: any) {
    console.error('[ECPay eSIM] Error processing callback:', err)
    return new NextResponse('1|OK', { status: 200 })
  }
}
