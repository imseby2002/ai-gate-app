import { NextRequest, NextResponse } from 'next/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { getUnitContext } from '@/lib/auth/unit-access'
import { APPLY_BUCKET, DOC_LABEL } from '@/lib/hr/apply'

export const maxDuration = 120

const MAX_DOCS = 10
const MAX_BYTES = 6 * 1024 * 1024 // 單檔上限，避免請求過大
// 依副檔名判斷 Claude 可讀型別（PDF／圖片）
function mediaTypeOf(name: string): string | null {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  return null
}

// AI 將該人員上傳的文件轉文字並彙整成「完整基本資料」，存入 profile_text（日後選材）。
export async function POST(req: NextRequest) {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 400 })
  const { admin, ownerId } = ctx

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: person } = await admin.from('agent_hr_candidates')
    .select('id, name, position, store').eq('id', id).eq('user_id', ownerId).single()
  if (!person) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data: docs } = await admin.from('hr_candidate_documents')
    .select('doc_type, label, file_name, storage_path').eq('candidate_id', id).eq('owner_id', ownerId)
  if (!docs || docs.length === 0) return NextResponse.json({ error: '此人員尚無上傳文件' }, { status: 400 })
  const parts: Array<Record<string, unknown>> = [{
    type: 'text',
    text: `以下是員工「${person.name || ''}」上傳的人事文件。請逐份辨識內容，將每份文件轉為文字，並彙整成一份「完整個人基本資料」（繁體中文）。\n` +
      `輸出格式：\n1) 各文件重點（文件名稱＋擷取到的關鍵欄位與內容）\n2) 彙整基本資料（姓名、性別、生日、籍貫、身分證/CCCD、學歷、經歷、健康狀況、其他重要資訊）\n` +
      `僅根據文件內容，不要臆測；看不清楚的欄位標「不清楚」。`,
  }]

  const skipped: string[] = []
  let used = 0
  for (const d of docs) {
    if (used >= MAX_DOCS) break
    const mediaType = mediaTypeOf(d.file_name)
    if (!mediaType) { skipped.push(`${d.label || DOC_LABEL[d.doc_type] || d.file_name}（不支援型別）`); continue }
    const { data: blob, error } = await admin.storage.from(APPLY_BUCKET).download(d.storage_path)
    if (error || !blob) { skipped.push(`${d.file_name}（下載失敗）`); continue }
    const buf = new Uint8Array(await blob.arrayBuffer())
    if (buf.byteLength > MAX_BYTES) { skipped.push(`${d.file_name}（超過 6MB）`); continue }
    const title = d.label || DOC_LABEL[d.doc_type] || d.file_name
    parts.push({ type: 'text', text: `── 文件：${title} ──` })
    parts.push({ type: 'file', data: buf, mediaType })
    used++
  }
  if (used === 0) return NextResponse.json({ error: `無可辨識的文件（${skipped.join('、')}）` }, { status: 400 })

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let text = ''
  try {
    const res = await generateText({
      model: anthropic('claude-sonnet-4-5'),
      maxOutputTokens: 6000,
      messages: [{ role: 'user', content: parts as never }],
    })
    text = res.text
  } catch (e) {
    return NextResponse.json({ error: `AI 辨識失敗：${e instanceof Error ? e.message : e}` }, { status: 500 })
  }

  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const profile_text = `【AI 彙整 ${stamp}】\n${text}${skipped.length ? `\n\n（未處理：${skipped.join('、')}）` : ''}`
  const { error: upErr } = await admin.from('agent_hr_candidates').update({ profile_text, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', ownerId)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, used, skipped, profile_text })
}
