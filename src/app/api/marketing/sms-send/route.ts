/**
 * POST /api/marketing/sms-send
 * 批次寄送行銷簡訊（智慧多國分流）
 *
 * - 🇹🇼 台灣號碼：自動經由 sms-get.com
 * - 🇻🇳 越南號碼：自動經由 Stringee (或 Zalo ZNS)
 * - 🇺🇸 北美號碼：自動經由 Bird (備援 Twilio)
 * - 🌐 其他國際：自動經由 Twilio (備援 Bird)
 *
 * 扣點：依國別每段成本 × 分段數 × 方案倍率，僅計成功發送
 *
 * Body: {
 *   recipients: { phone: string; group?: string; name?: string }[]
 *   groups?: { [group: string]: { text: string } }
 *   defaultText: string
 *   zaloTemplateId?: string
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCronOrUserAuth } from '@/lib/cron-auth'
import { chargeUsage, precheckUsage, smsCost } from '@/lib/marketing/billing'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { sendBatchSms, querySmsGetCredit } from '@/lib/telephony/sms-service'

export async function POST(req: NextRequest) {
  const user = await getCronOrUserAuth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const {
    recipients = [],
    groups = {},
    defaultText = '',
    zaloTemplateId,
  } = body

  if (!defaultText?.trim() && Object.keys(groups).length === 0) {
    return NextResponse.json({ error: '簡訊內容不可為空' }, { status: 400 })
  }

  const validRecipients = (recipients as Array<{ phone?: string; name?: string; group?: string }>)
    .filter(r => r?.phone && r.phone.trim().length >= 8)

  if (validRecipients.length === 0) {
    return NextResponse.json({ error: '收件門號清單為空或格式不符' }, { status: 400 })
  }

  // 提取各分組文案
  const groupTexts: Record<string, string> = {}
  for (const [gName, gVal] of Object.entries(groups as Record<string, { text?: string }>)) {
    if (gVal?.text) groupTexts[gName] = gVal.text
  }
  // 與 sendBatchSms 相同的個人化規則，用來估算分段數
  const textFor = (r: { phone?: string; name?: string; group?: string }) =>
    ((r.group && groupTexts[r.group]) || defaultText || '')
      .replace(/\{name\}/g, r.name || '客戶')
      .replace(/\{phone\}/g, r.phone?.trim() ?? '')

  // 權限與方案檢查
  if (!user.isCron) {
    const { plan, features } = await getMarketingEntitlements(null, user.id)
    if (!features.aiCallEmail && features.prospectMarketing === 'collectOnly') {
      return NextResponse.json({ error: '目前方案未開放簡訊行銷，請升級至 PRO 以上', plan }, { status: 403 })
    }
    const estimate = validRecipients.reduce((sum, r) => sum + smsCost(r.phone!, textFor(r)), 0)
    const insufficient = await precheckUsage(user.id, estimate)
    if (insufficient) return NextResponse.json(insufficient, { status: 402 })
  }

  // 執行批次智慧分流發送
  const { total, success, results } = await sendBatchSms(
    validRecipients.map(r => ({ phone: r.phone!, name: r.name, group: r.group })),
    defaultText,
    groupTexts,
    zaloTemplateId,
  )

  // 成功發送才扣點：依實際門號國別與分段數計算成本
  if (!user.isCron && success > 0) {
    const costUsd = validRecipients.reduce((sum, r, i) => sum + (results[i]?.ok ? smsCost(r.phone!, textFor(r)) : 0), 0)
    await chargeUsage(user.id, costUsd, `[marketing] 批次發送行銷簡訊 ${success} 則`)
  }

  return NextResponse.json({
    ok: true,
    total,
    success,
    failed: total - success,
    results,
  })
}

export async function GET(req: NextRequest) {
  const user = await getCronOrUserAuth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const twRes = await querySmsGetCredit()
  return NextResponse.json({
    ok: true,
    tw: {
      provider: 'sms-get.com',
      configured: !!(process.env.SMSGET_USERNAME && process.env.SMSGET_PASSWORD),
      credits: twRes.ok ? twRes.credits : null,
      error: twRes.ok ? null : twRes.error,
    },
  })
}
