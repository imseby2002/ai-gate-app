/**
 * POST /api/marketing/sms-send
 * 批次寄送行銷簡訊（智慧多國分流）
 *
 * - 🇹🇼 台灣號碼：自動經由 sms-get.com
 * - 🇻🇳 越南號碼：自動經由 Stringee (或 Zalo ZNS)
 * - 🌐 其他國際：自動經由 Twilio (備援 Bird)
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
import { SMS_COST, checkCredits, deductCredits, isBillableUser } from '@/lib/marketing/billing'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { sendBatchSms } from '@/lib/telephony/sms-service'

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

  // 權限與方案檢查
  const billable = !user.isCron && await isBillableUser(user.id)
  if (!user.isCron) {
    const { plan, features } = await getMarketingEntitlements(null, user.id)
    if (!features.aiCallEmail && features.prospectMarketing === 'collectOnly') {
      return NextResponse.json({ error: '目前方案未開放簡訊行銷，請升級至 PRO 以上', plan }, { status: 403 })
    }
    const estimate = SMS_COST * validRecipients.length
    const check = await checkCredits(user.id, estimate, billable)
    if (!check.ok) return NextResponse.json(check.payload, { status: 402 })
  }

  // 提取各分組文案
  const groupTexts: Record<string, string> = {}
  for (const [gName, gVal] of Object.entries(groups as Record<string, { text?: string }>)) {
    if (gVal?.text) groupTexts[gName] = gVal.text
  }

  // 執行批次智慧分流發送
  const { total, success, results } = await sendBatchSms(
    validRecipients.map(r => ({ phone: r.phone!, name: r.name, group: r.group })),
    defaultText,
    groupTexts,
    zaloTemplateId,
  )

  // 成功發送才依成功數量扣點
  if (!user.isCron && success > 0) {
    await deductCredits(
      user.id,
      SMS_COST * success,
      `[marketing] 批次發送行銷簡訊 ${success} 則`,
      billable,
    )
  }

  return NextResponse.json({
    ok: true,
    total,
    success,
    failed: total - success,
    results,
  })
}
