// AI 客服回覆時引用統一客戶系統（CRM）的客人資料：
// 依客人目前使用的平台帳號（LINE / WhatsApp / …）找到 crm_contacts，
// 把稱呼、標籤、特質、累計往來與最近紀錄整理成 prompt 區塊。
import type { SupabaseClient } from '@supabase/supabase-js'
import { csPlatformToKind, normalizeIdentity } from './normalize'

const SOURCE_LABEL: Record<string, string> = { reserve: '服務預約', booking: '訂房', esim: 'eSIM', cs: '客服對話', manual: '備註' }
const TIMEOUT_MS = 1500

async function load(db: SupabaseClient, ownerId: string, platform: string, fromId: string): Promise<string> {
  const kind = csPlatformToKind(platform)
  if (!kind) return ''
  const value = normalizeIdentity(kind, fromId)
  if (!value) return ''

  const { data: ident } = await db.from('crm_identities').select('contact_id')
    .eq('owner_id', ownerId).eq('kind', kind).eq('value', value).maybeSingle()
  if (!ident) return ''

  const [{ data: c }, { data: acts }] = await Promise.all([
    db.from('crm_contacts').select('display_name, tags, traits, order_count, total_spent, first_seen_at, last_activity_at')
      .eq('id', ident.contact_id).maybeSingle(),
    db.from('crm_activities').select('source, kind, title, status, occurred_at')
      .eq('contact_id', ident.contact_id).neq('kind', 'conversation')
      .order('occurred_at', { ascending: false }).limit(8),
  ])
  if (!c) return ''

  const lines: string[] = ['\n\n【客戶檔案（統一客戶系統）——內部參考資料，用來提供貼心、個人化的服務；不要逐字唸給客人聽，也不要主動透露標籤、消費金額或內部評語】']
  if (c.display_name) lines.push(`姓名：${c.display_name}`)
  if (c.tags?.length) lines.push(`標籤：${c.tags.join('、')}`)
  if (c.traits) lines.push(`客人特質／偏好（回覆時請主動照顧到）：${String(c.traits).slice(0, 500)}`)
  if (c.order_count > 0) lines.push(`過往往來：共 ${c.order_count} 次預約／訂房／購買${c.first_seen_at ? `，首次在 ${String(c.first_seen_at).slice(0, 10)}` : ''}，屬於回頭客，請以熟客的語氣接待。`)
  if (acts?.length) {
    lines.push('最近紀錄：')
    for (const a of acts) {
      lines.push(`- ${String(a.occurred_at).slice(0, 10)}［${SOURCE_LABEL[a.source] ?? a.source}］${a.title}${a.status ? `（${a.status}）` : ''}`)
    }
    lines.push('若客人詢問的是上述既有預約／訂單，可直接引用，不必再請客人提供基本資料；但涉及修改、退款或金額時仍須依原本流程查詢確認。')
  }
  return lines.length > 1 ? lines.join('\n') : ''
}

/** 取得 CRM 客戶檔案 prompt 區塊；查不到或逾時回傳空字串，不影響客服回覆。 */
export async function buildCrmSection(db: SupabaseClient, ownerId: string, platform: string, fromId: string): Promise<string> {
  try {
    return await Promise.race([
      load(db, ownerId, platform, fromId),
      new Promise<string>(resolve => setTimeout(() => resolve(''), TIMEOUT_MS)),
    ])
  } catch (err) {
    console.error('[crm-cs-context]', err)
    return ''
  }
}
