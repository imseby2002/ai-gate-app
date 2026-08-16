/**
 * 表單提交防護 —— 公開表單頁與 CS 對話填表共用。
 *
 * 真實案例：客人透過早餐直送連結重複點開／重新整理，同一份早餐訂單一模一樣的內容
 * 在同一天內被送出 2～3 次，員工重複備餐；另外非當天入住的客人也能訂到早餐，
 * 系統完全沒有比對過訂房資料。這裡補上兩層檢查：同一天內完全相同的回答視為
 * 重複送出直接擋掉；表單有「房號」類欄位時，若答案能對應到系統裡實際的房型，
 * 進一步比對當天是否真的有該房型的訂房紀錄。
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CsFormField } from '@/app/api/marketing/cs-forms/route'

function taipeiTodayRange(): { startIso: string; endIso: string } {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  const start = new Date(`${todayStr}T00:00:00+08:00`)
  return { startIso: start.toISOString(), endIso: new Date(start.getTime() + 86400000).toISOString() }
}

const ROOM_FIELD_RE = /房號|房型|room/i

function normalizeRoomText(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
}

function roomAnswerValue(fields: CsFormField[], answers: Record<string, string>): string {
  const roomField = fields.find(f => ROOM_FIELD_RE.test(f.label))
  return roomField ? (answers[roomField.id] ?? '').trim() : ''
}

export interface TodaySubmissionMatch {
  kind: 'duplicate' | 'update' | 'new'
  existingId?: string
}

/**
 * 同一天內、同一張表單，比對是否已經有紀錄：
 * - 表單有「房號」類欄位時，用房號當識別 key——同房號已有紀錄，新答案完全相同
 *   視為客人重複點擊；答案不同（例如客人改了餐點）視為更新，覆蓋原紀錄，不再
 *   另開一筆讓員工分不清哪筆才是最終版本
 * - 沒有房號欄位（無法辨識是誰的訂單）就退回單純比對整份回答內容是否完全相同
 */
export async function resolveTodaySubmission(
  supabase: SupabaseClient, formId: string, fields: CsFormField[], answers: Record<string, string>,
): Promise<TodaySubmissionMatch> {
  const { startIso, endIso } = taipeiTodayRange()
  const { data } = await supabase
    .from('cs_form_submissions')
    .select('id, answers')
    .eq('form_id', formId)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('created_at', { ascending: false })
    .limit(50)
  const rows = (data ?? []) as { id: string; answers: Record<string, string> }[]
  const key = JSON.stringify(answers)

  const roomKey = roomAnswerValue(fields, answers)
  if (roomKey) {
    const sameRoom = rows.find(r => roomAnswerValue(fields, r.answers) === roomKey)
    if (!sameRoom) return { kind: 'new' }
    return JSON.stringify(sameRoom.answers) === key
      ? { kind: 'duplicate' }
      : { kind: 'update', existingId: sameRoom.id }
  }

  return rows.some(r => JSON.stringify(r.answers) === key) ? { kind: 'duplicate' } : { kind: 'new' }
}

export async function verifyRoomCheckedInToday(
  supabase: SupabaseClient, userId: string, fields: CsFormField[], answers: Record<string, string>,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const roomField = fields.find(f => ROOM_FIELD_RE.test(f.label))
  const roomAnswer = roomField ? (answers[roomField.id] ?? '').trim() : ''
  if (!roomAnswer) return { ok: true }

  const { data: properties } = await supabase.from('properties').select('id, name').eq('user_id', userId)
  const norm = normalizeRoomText(roomAnswer)
  const matched = (properties ?? []).find(p => {
    const pn = normalizeRoomText(p.name ?? '')
    return pn && (norm.includes(pn) || pn.includes(norm))
  })
  // 答案對應不到系統裡任何房型（例如自訂文字、拼字略有出入）就不擋，避免誤判正常訂單
  if (!matched) return { ok: true }

  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  const [{ data: bk }, { data: pub }] = await Promise.all([
    supabase.from('bookings').select('id')
      .eq('user_id', userId).eq('property_id', matched.id).in('status', ['pending', 'confirmed'])
      .lte('check_in', todayIso).gt('check_out', todayIso).limit(1),
    supabase.from('public_bookings').select('id')
      .eq('host_user_id', userId).eq('property_id', matched.id).in('status', ['pending', 'confirmed'])
      .lte('check_in', todayIso).gt('check_out', todayIso).limit(1),
  ])
  if ((bk?.length ?? 0) > 0 || (pub?.length ?? 0) > 0) return { ok: true }
  return { ok: false, reason: `查無「${matched.name}」今天入住的訂房紀錄，如需訂餐請確認房號是否正確，或聯繫我們協助處理` }
}
