// 總經理室 AI 快報：彙整快照 → AI 摘要 → 存檔 → 站內／Telegram／Email 推播。
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendToCustomer } from '@/lib/cs/send'
import { getAffairSettings, taipeiDate } from '@/lib/affairs/reminders'
import { buildGmSnapshot, type GmSnapshot } from '@/lib/gm/snapshot'

type Admin = ReturnType<typeof createAdminClient>
const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
const pct = (n: number) => (n * 100).toFixed(1) + '%'

const KIND_LABEL: Record<string, string> = { daily: '每日快報', weekly: '每週經營彙整', monthly: '月度經營報告' }

// 快照壓成精簡文字供 AI 參考
export function snapshotToText(snap: GmSnapshot): string {
  const L: string[] = []
  if (snap.flags.length) {
    L.push('【需注意事項】')
    for (const f of snap.flags) L.push(`- [${f.level}] ${f.dept}：${f.text}`)
  } else L.push('【需注意事項】無')
  if (snap.finance) {
    const t = snap.finance.total
    L.push(`\n【損益（期間 ${snap.finance.period}）】`)
    L.push(`全公司：營業額 ${fmt(t.revenue)}、毛利 ${fmt(t.gross_profit)}（${t.revenue ? pct(t.gross_profit / t.revenue) : '—'}）、淨利 ${fmt(t.profit)}（${t.revenue ? pct(t.profit / t.revenue) : '—'}）`)
    for (const s of snap.finance.stores.slice(0, 20)) {
      L.push(`- ${s.name}：營業額 ${fmt(s.revenue)}、毛利率 ${pct(s.gross_margin)}、淨利 ${fmt(s.profit)}`)
    }
  }
  L.push(`\n【維修】進行中工單 ${snap.repair.open}、逾期 ${snap.repair.overdue}、保固將到期設備 ${snap.repair.warranty_soon}`)
  L.push(`【外務】30 天內到期文件 ${snap.affairs.count}${snap.affairs.expiring.slice(0, 8).map(d => `\n- ${d.title || d.doc_type}（${d.expiry_date}，${d.days < 0 ? `逾期 ${-d.days} 天` : `${d.days} 天`}）`).join('')}`)
  L.push(`【人事】在職 ${snap.hr.active}、本月新進 ${snap.hr.new_this_month}、合約 60 天內到期 ${snap.hr.contracts_expiring}`)
  L.push(`【稽核】啟用硬性規定 ${snap.audit.active_rules} 條`)
  L.push(`【行銷】外送當月營收 ${fmt(snap.marketing.delivery_revenue)}（訂單 ${fmt(snap.marketing.delivery_orders)}）、內容待審核 ${snap.marketing.content_review}、實體行銷進行中 ${snap.marketing.offline_active}`)
  return L.join('\n').slice(0, 8000)
}

async function summarize(snap: GmSnapshot, kind: string, dateLabel: string): Promise<string> {
  const body = snapshotToText(snap)
  if (!process.env.ANTHROPIC_API_KEY) {
    // 無 AI 金鑰時退回結構化文字，仍可推播
    return `${KIND_LABEL[kind] ?? kind}（${dateLabel}）\n\n${body}`
  }
  // 依報告類型調整深度：每日精簡、每週/月度較完整並含建議
  const depth = kind === 'daily'
    ? '請用繁體中文、條列、精煉，控制在 400 字內。'
    : kind === 'weekly'
      ? '請用繁體中文，分「一、需總經理決策事項」「二、各部門重點（財務營運／維修／外務法遵／人事／稽核）」「三、建議行動」三段，控制在 800 字內。'
      : '請用繁體中文，做完整月度經營回顧，分「一、經營總結」「二、需總經理決策事項」「三、各部門重點」「四、下月建議」四段，控制在 1200 字內。'
  const system = `你是連鎖飲料公司的總經理特助，負責把各部門資料彙整成給總經理看的${KIND_LABEL[kind] ?? '經營'}。
原則：exception-first——先講需要總經理注意/決策的異常（虧損門市、逾期工單、文件逾期等），再給關鍵數字重點；正常項目簡述即可。
${depth} 語氣務實，不要編造資料裡沒有的數字。`
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await generateText({
    model: anthropic('claude-sonnet-4-5'), system, maxOutputTokens: kind === 'daily' ? 1200 : 2500,
    messages: [{ role: 'user', content: `以下是 ${dateLabel} 的彙整資料，請產出${KIND_LABEL[kind] ?? '摘要'}：\n\n${body}` }],
  })
  return res.text.trim()
}

// 產生並推播一份快報（kind: daily/weekly/monthly）。回傳存檔 id 與已推播管道。
export async function generateGmReport(admin: Admin, ownerId: string, kind: 'daily' | 'weekly' | 'monthly' = 'daily'):
  Promise<{ id: string; title: string; content: string; channels: string[] }> {
  const dateLabel = taipeiDate(0)
  const snap = await buildGmSnapshot(admin, ownerId)
  const content = await summarize(snap, kind, dateLabel)
  const title = `${KIND_LABEL[kind] ?? kind}・${dateLabel}`

  const st = await getAffairSettings(admin, ownerId)
  const channels: string[] = ['站內']

  // 站內：hr_notifications
  await admin.from('hr_notifications').insert({ owner_id: ownerId, kind: `gm_${kind}`, title, body: content })

  // Telegram
  if (st.gm_telegram) {
    try { await sendToCustomer(ownerId, 'telegram', st.gm_telegram, `📊 ${title}\n\n${content}`); channels.push('telegram') } catch { /* best-effort */ }
  }
  // Email
  if (st.gm_email && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'AI Gate <hr@im-tourist.com>',
        to: [st.gm_email], subject: title, text: content,
      })
      channels.push('email')
    } catch { /* best-effort */ }
  }

  // 存檔（同 owner+kind+日期覆蓋）
  const { data, error } = await admin.from('gm_reports')
    .upsert({ owner_id: ownerId, kind, report_date: dateLabel, title, content, snapshot: snap, channels: channels.join(',') },
      { onConflict: 'owner_id,kind,report_date' })
    .select('id').single()
  if (error) throw new Error(error.message)
  return { id: data.id, title, content, channels }
}
