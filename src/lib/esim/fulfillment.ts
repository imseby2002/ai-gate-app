import { microEsimClient } from './microesim'
import { getEsimOrderByNo, updateEsimOrder, EsimOrder } from './db'
import { Resend } from 'resend'

/**
 * 執行 eSIM 履約與 MicroEsim 訂單發卡流程
 */
export async function fulfillEsimOrder(orderNo: string): Promise<{ success: boolean; order: EsimOrder | null; message: string }> {
  const order = await getEsimOrderByNo(orderNo)
  if (!order) {
    return { success: false, order: null, message: '找不到此訂單' }
  }

  // 避免重複發卡
  if (order.microesim_status === 'delivered' && order.qr_code_url) {
    return { success: true, order, message: '訂單已完成發卡' }
  }

  console.log(`[EsimFulfill] Starting fulfillment for order: ${orderNo} (${order.channel_dataplan_name})...`)

  try {
    let topupId = ''
    let iccid = ''
    let qrCodeUrl = ''
    let activationCode = ''
    let apn = order.apn || 'auto'
    let metadataExtra: Record<string, any> = {}

    if (order.payment_method === 'test_mode' || order.payment_method === 'demo') {
      console.log(`[EsimFulfill] Fulfilling test mode order ${orderNo} without deducting vendor balance...`)
      topupId = `TEST_TOPUP_${Date.now()}`
      iccid = `89810${Math.floor(100000000000000 + Math.random() * 900000000000000)}`
      activationCode = `LPA:1$esiminfra.toprsp.com$TEST-${orderNo.replace(/[^a-zA-Z0-9]/g, '')}`
      qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(activationCode)}`
      metadataExtra = {
        ios_esim_install_link: `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(activationCode)}`,
        android_esim_install_link: `https://esimsetup.android.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(activationCode)}`,
        device_ids: [iccid],
      }
    } else {
      // 1. 呼叫 MICROESIM.TOP 下單 API (真實付款訂單)
      const subResult = await microEsimClient.subscribeEsim(order.channel_dataplan_id, order.quantity)
      console.log(`[EsimFulfill] MicroEsim subscribe result:`, JSON.stringify(subResult))

      topupId = subResult.result?.topup_id || subResult.result?.order_id || ''

      if (subResult.code === 1 && topupId) {
        // 2. 獲取發卡細節
        // MicroEsim 發卡後需要短暫 1-2 秒生成 eSIM profile
        await new Promise(r => setTimeout(r, 1500))

        const detailResult = await microEsimClient.getTopupDetail(topupId)
        console.log(`[EsimFulfill] Topup detail result:`, JSON.stringify(detailResult))

        if (detailResult.code === 1 && detailResult.result) {
          const res = detailResult.result
          iccid = res.iccid || (Array.isArray(res.device_ids) ? res.device_ids[0] : '') || ''
          activationCode = res.ac || (Array.isArray(res.lpa_str) ? res.lpa_str[0] : '') || ''
          qrCodeUrl = res.qr_code || (Array.isArray(res.qrcode) ? res.qrcode[0] : '') || ''
          if (res.apn) apn = res.apn

          metadataExtra = {
            ios_esim_install_link: res.ios_esim_install_link?.[0] || null,
            android_esim_install_link: res.android_esim_install_link?.[0] || null,
            device_ids: res.device_ids || (iccid ? [iccid] : []),
          }
        }
      } else {
        await updateEsimOrder(orderNo, {
          microesim_status: 'failed',
          error_message: subResult.msg || 'MicroEsim 訂單建立失敗',
        })
        return { success: false, order, message: subResult.msg || 'MicroEsim 訂購失敗' }
      }
    }

    // 確保如果 MicroEsim 有 activationCode 但沒有直接給 qrCodeUrl，以 QR Server 產生標準 QR 圖檔網址
    if (activationCode && !qrCodeUrl) {
      qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(activationCode)}`
    }

    // 3. 更新訂單狀態為已發卡
    const updated = await updateEsimOrder(orderNo, {
      payment_status: 'paid',
      microesim_status: 'delivered',
      microesim_topup_id: topupId,
      iccid,
      qr_code_url: qrCodeUrl,
      activation_code: activationCode,
      apn,
      paid_at: order.paid_at || new Date().toISOString(),
      metadata: {
        ...(order.metadata || {}),
        ...metadataExtra,
      },
    })

    // 4. 寄送 Email 確認與開通通知
    if (updated && !updated.email_sent && updated.customer_email) {
      await sendEsimDeliveryEmail(updated).catch(err => {
        console.warn('[EsimFulfill] Email sending non-fatal error:', err)
      })
    }

    return { success: true, order: updated, message: '發卡成功' }
  } catch (err: any) {
    console.error(`[EsimFulfill] Error fulfilling order ${orderNo}:`, err)
    await updateEsimOrder(orderNo, {
      error_message: err.message,
    })
    return { success: false, order, message: err.message }
  }
}

/**
 * 寄送出國上網 eSIM 開通確認信
 */
export async function sendEsimDeliveryEmail(order: EsimOrder): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[EsimEmail] RESEND_API_KEY not configured, skipping email delivery.')
    return false
  }

  const resend = new Resend(apiKey)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://esim.im-tourist.com'
  const lookupUrl = `${appUrl}/esim/order/${order.order_no}`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>您的出國上網 eSIM 已開通 - 訂單 ${order.order_no}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; margin: 0; padding: 20px; }
        .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
        .header { background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; padding: 32px 24px; text-align: center; }
        .content { padding: 32px 24px; }
        .qr-box { text-align: center; margin: 24px 0; padding: 24px; background: #f1f5f9; border-radius: 12px; }
        .qr-img { width: 220px; height: 220px; border-radius: 8px; border: 4px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .info-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        .info-table td.label { color: #64748b; width: 35%; }
        .info-table td.val { font-weight: 600; color: #0f172a; }
        .code-box { background: #0f172a; color: #38bdf8; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 13px; word-break: break-all; }
        .btn { display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; margin-top: 16px; }
        .steps { background: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; border-radius: 4px; margin-top: 24px; font-size: 14px; }
        .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1 style="margin:0; font-size: 24px;">🎉 您的出國上網 eSIM 已發卡成功</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">感謝您選擇 imTourist 全球 eSIM 服務</p>
        </div>
        <div class="content">
          <p>親愛的 <strong>${order.customer_name || '旅客'}</strong> 您好：</p>
          <p>您的 eSIM 訂單已完成付款與線上發卡，以下為您的 eSIM 開通憑證與詳細規格：</p>

          <table class="info-table">
            <tr><td class="label">訂單編號</td><td class="val">${order.order_no}</td></tr>
            <tr><td class="label">目的地國家</td><td class="val">${order.country_name} (${order.country_code})</td></tr>
            <tr><td class="label">資費方案</td><td class="val">${order.channel_dataplan_name}</td></tr>
            <tr><td class="label">有效天數</td><td class="val">${order.day} 天</td></tr>
            <tr><td class="label">高速流量</td><td class="val">${order.data_amount}</td></tr>
            <tr><td class="label">ICCID 卡號</td><td class="val">${order.iccid || '開通後顯示'}</td></tr>
            <tr><td class="label">APN 設定</td><td class="val">${order.apn || '自動偵測'}</td></tr>
          </table>

          <div class="qr-box">
            <h3 style="margin-top:0;">📱 掃描 QR Code 加入行動方案</h3>
            ${order.qr_code_url ? `<img src="${order.qr_code_url}" class="qr-img" alt="eSIM QR Code" />` : '<p>（請點擊下方按鈕前往訂單頁檢視）</p>'}
            <p style="font-size:12px; color:#64748b; margin-top: 8px;">建議使用另一台手機或平板出示此 QR Code，再以出國手機掃描安裝</p>
          </div>

          ${order.activation_code ? `
            <p style="margin-bottom: 4px; font-weight: 600; font-size: 14px;">手動安裝啟用碼 (SM-DP+ Address & Activation Code)：</p>
            <div class="code-box">${order.activation_code}</div>
          ` : ''}

          <div class="steps">
            <strong>🚀 簡易 3 步驟安裝教學：</strong>
            <ol style="margin: 8px 0 0; padding-left: 20px;">
              <li><strong>出發前安裝</strong>：手機連接 Wi-Fi，進入「設定」>「行動服務」>「加入 eSIM / 加入行動方案」，掃描上方 QR Code。</li>
              <li><strong>關閉原門號漫遊</strong>：出發前請維持主要門號接聽電話，行動數據切換為此 eSIM。</li>
              <li><strong>抵達目的地開啟漫遊</strong>：飛機落地後，開啟此 eSIM 的「數據漫遊」，即可自動連接當地優質高速網路！</li>
            </ol>
          </div>

          <div style="text-align: center;">
            <a href="${lookupUrl}" class="btn">前往線上訂單中心檢視</a>
          </div>
        </div>
        <div class="footer">
          <p>imTourist 全球旅遊連線服務團隊 | 客服信箱：service@im-tourist.com</p>
          <p>此郵件為系統自動發送，請勿直接回覆。</p>
        </div>
      </div>
    </body>
    </html>
  `

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'esim@im-tourist.com'
  const { error } = await resend.emails.send({
    from: `imTourist eSIM <${fromEmail}>`,
    to: [order.customer_email],
    subject: `【imTourist】您的 ${order.country_name} 出國上網 eSIM 已發卡成功 (訂單 ${order.order_no})`,
    html,
  })

  if (error) {
    console.error('[EsimEmail] Resend error:', error)
    return false
  }

  await updateEsimOrder(order.order_no, { email_sent: true })
  console.log(`[EsimEmail] Confirmation email sent successfully to ${order.customer_email}`)
  return true
}
