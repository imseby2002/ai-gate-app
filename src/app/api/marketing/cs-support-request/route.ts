import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBnbContext } from '@/lib/bnb/context'
import { getCsEntitlements } from '@/lib/cs/entitlements'
import { resolveFeedbackBilling } from '@/lib/feedback/billing'
import { runFeedbackAutoFix } from '@/lib/feedback/autofix'
import { notifyFeedbackAdmin } from '@/lib/feedback/notify'

export const maxDuration = 300

const HARD_CAP_PER_MONTH = 10
const VALID_TYPES = ['feature', 'feedback']

// POST /api/marketing/cs-support-request
// 「客製功能需求」與「問題反映」的送出端點。與 cs-setup-request（找人幫我設定）分開。
// 兩者都併入全模組共用的 user_feedback：問題反映（AI 回答錯誤）免費、AI 直接修、
// 老闆確認合併；客製功能預設要計費（公司被標記免費則跳過），需老闆先核准才會跑 AI。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, contact = '', note = '' } = await req.json()
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  if (!note?.trim()) return NextResponse.json({ error: '請填寫需求說明' }, { status: 400 })

  const admin = createAdminClient()

  const nowTaipei = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const monthStart = `${nowTaipei.getFullYear()}-${String(nowTaipei.getMonth() + 1).padStart(2, '0')}-01T00:00:00+08:00`
  const { count } = await admin
    .from('user_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.user.id)
    .eq('source', 'cs')
    .gte('created_at', monthStart)

  if ((count ?? 0) >= HARD_CAP_PER_MONTH) {
    return NextResponse.json({ error: '本月申請次數過多，請聯繫我們確認狀況。' }, { status: 429 })
  }

  const { plan } = await getCsEntitlements(admin, ctx.ownerId)
  const fbType = type === 'feature' ? 'feature' : 'ai_error'
  const typeLabel = type === 'feature' ? '客製功能需求' : '問題反映'

  const { data: profile } = await admin.from('profiles').select('company_id').eq('id', ctx.user.id).single()
  const companyId = profile?.company_id ?? null
  const { isPaid, initialStatus } = await resolveFeedbackBilling(companyId, fbType)

  const { data: row, error } = await admin
    .from('user_feedback')
    .insert({
      user_id: ctx.user.id,
      title: `[CS ${typeLabel}] ${note.trim().slice(0, 60)}`,
      description: note.trim(),
      type: fbType,
      contact: contact?.trim() || null,
      company_id: companyId,
      is_paid: isPaid,
      status: initialStatus,
      source: 'cs',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await notifyFeedbackAdmin(
    `[CS ${typeLabel}] ${ctx.user.email ?? ctx.user.id}${isPaid ? '（待報價審核）' : ''}`,
    [
      `類型：${typeLabel}`,
      `帳號 email：${ctx.user.email ?? '（未知）'}`,
      `CS 方案：${plan}`,
      `聯絡方式：${contact || '（未留）'}`,
      `內容：${note}`,
      isPaid
        ? '此項目需計費，請至後台審核／報價／核准或拒絕：https://www.im-tourist.com/admin/feedback'
        : 'AI 將自動處理，完成後請至後台確認合併：https://www.im-tourist.com/admin/feedback',
    ]
  )

  // 免費項目（問題反映）直接觸發 AI 自動修復；計費項目要等後台核准。
  // 用 after() 讓平台在回應送出後還能繼續跑，不能不 await 就直接 return——
  // 這支 route 的執行環境本身在回應送出後就可能被回收，沒有另一個獨立的
  // client fetch 幫忙撐住連線（不像網頁/APP 是自己另外呼叫一次 /api/feedback/[id]）。
  if (!isPaid) {
    after(() => runFeedbackAutoFix(row.id).catch(() => { /* 錯誤已記錄在 user_feedback.error_log */ }))
  }

  return NextResponse.json({ ok: true, id: row.id, priceUsd: null })
}
