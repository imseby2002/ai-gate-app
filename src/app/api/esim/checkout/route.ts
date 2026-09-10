import { NextRequest, NextResponse } from 'next/server'
import { microEsimClient } from '@/lib/esim/microesim'
import { parseMicroEsimPlan } from '@/lib/esim/catalog'
import { createEsimOrder, updateEsimOrder } from '@/lib/esim/db'
import { fulfillEsimOrder } from '@/lib/esim/fulfillment'
import {
  getEcpayConfig,
  generateCheckMac,
  formatEcpayTradeDate,
  resolvePayReturn,
} from '@/lib/ecpay/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      channel_dataplan_id,
      customer_email,
      customer_name,
      customer_phone,
      quantity = 1,
      payment_method = 'ecpay',
      return_url,
    } = body

    if (!channel_dataplan_id) {
      return NextResponse.json({ error: '請選擇 eSIM 資費方案' }, { status: 400 })
    }

    if (!customer_email || !customer_email.includes('@')) {
      return NextResponse.json({ error: '請填寫正確的電子信箱以接收 eSIM QR Code' }, { status: 400 })
    }

    const qty = Math.max(1, Math.min(10, parseInt(String(quantity), 10) || 1))

    // 1. 從原生清單驗證方案
    const allPlans = await microEsimClient.getDataplanList()
    const rawPlan = allPlans.find(p => p.channel_dataplan_id === channel_dataplan_id)
    if (!rawPlan) {
      return NextResponse.json({ error: '找不到指定的 eSIM 方案或該方案已下架' }, { status: 404 })
    }

    const parsedPlan = parseMicroEsimPlan(rawPlan)
    const unitPriceTwd = parsedPlan.retailPriceTwd
    const totalPriceTwd = unitPriceTwd * qty
    const costHkd = parsedPlan.costHkd * qty

    // 2. 產生獨一無二的訂單編號（20 字元內，方便綠界 ECPay 相容）
    const timestampSuffix = Date.now().toString().slice(-7)
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase()
    const orderNo = `ES${timestampSuffix}${randomHex}`

    // 3. 建立訂單
    const order = await createEsimOrder({
      order_no: orderNo,
      customer_email: customer_email.trim(),
      customer_name: customer_name?.trim() || '旅客',
      customer_phone: customer_phone?.trim() || '',
      channel_dataplan_id: rawPlan.channel_dataplan_id,
      channel_dataplan_name: rawPlan.channel_dataplan_name,
      country_code: parsedPlan.primaryCountryCode,
      country_name: parsedPlan.primaryCountryName,
      day: parsedPlan.day,
      data_amount: parsedPlan.dataTierLabel,
      quantity: qty,
      unit_price_twd: unitPriceTwd,
      total_price_twd: totalPriceTwd,
      cost_hkd: costHkd,
      currency: 'TWD',
      payment_status: 'pending',
      payment_method: payment_method,
      microesim_status: 'pending',
      apn: parsedPlan.apn,
      operator_info: parsedPlan.networks,
      metadata: {
        raw_price_hkd: rawPlan.price,
        raw_data: rawPlan.data,
        rule_desc: rawPlan.rule_desc,
        ip: rawPlan.ip,
      },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://esim.im-tourist.com'
    const { origin } = resolvePayReturn(return_url)

    // 4. 若為測試付款模式 (即刻完成付款並觸發發卡)
    if (payment_method === 'test_mode' || payment_method === 'demo') {
      await updateEsimOrder(orderNo, {
        payment_status: 'paid',
        payment_trade_no: `TEST_${Date.now()}`,
        paid_at: new Date().toISOString(),
      })

      // 觸發發卡
      const fulfillRes = await fulfillEsimOrder(orderNo)

      return NextResponse.json({
        success: true,
        order_no: orderNo,
        payment_method: 'test_mode',
        fulfilled: fulfillRes.success,
        redirect_url: `/esim/order/${orderNo}`,
      })
    }

    // 5. 綠界科技 ECPay 付款整合
    const config = getEcpayConfig()
    const tradeDate = formatEcpayTradeDate()

    const ecpayParams: Record<string, string> = {
      MerchantID: config.merchantId,
      MerchantTradeNo: orderNo,
      MerchantTradeDate: tradeDate,
      PaymentType: 'aio',
      TotalAmount: String(totalPriceTwd),
      TradeDesc: encodeURIComponent(`imTourist eSIM ${parsedPlan.primaryCountryName}`),
      ItemName: `eSIM ${parsedPlan.primaryCountryName} ${parsedPlan.dataTierLabel} (${parsedPlan.day}天) x${qty}`,
      ReturnURL: `${appUrl}/api/esim/ecpay-return`,
      OrderResultURL: `${origin}/esim/order/${orderNo}?from_ecpay=1`,
      ChoosePayment: 'ALL',
      EncryptType: '1',
      ClientBackURL: `${origin}/esim/order/${orderNo}`,
    }

    const checkMacValue = await generateCheckMac(ecpayParams, config.hashKey, config.hashIV)
    ecpayParams.CheckMacValue = checkMacValue

    return NextResponse.json({
      success: true,
      order_no: orderNo,
      payment_method: 'ecpay',
      action: config.paymentUrl,
      params: ecpayParams,
      redirect_url: `/esim/order/${orderNo}`,
    })
  } catch (err: any) {
    console.error('[API esim/checkout] Error:', err)
    return NextResponse.json(
      { error: err.message || '結帳處理失敗，請稍後再試' },
      { status: 500 }
    )
  }
}
