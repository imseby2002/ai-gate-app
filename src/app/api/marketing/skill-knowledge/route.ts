/**
 * 內建專家「使用者自訂知識庫」— 讓 TEAM+ 使用者對某內建專家（skill）上傳連結／檔案／文字，
 * 執行時自動注入 system prompt（見 /api/skills/run）。
 *
 * GET    ?skillId=  → 列出自己對該專家的知識來源 + canBuild（是否 TEAM+）
 * POST   { skillId, type:'url'|'file'|'text', url?, text?, name? }  → 新增（需 TEAM+，依萃取字數扣點）
 *   （檔案：前端先呼叫 /api/marketing/upload-file 取得 textContent，再以 type='file' + text 送入）
 * DELETE ?id=  → 刪除自己的一筆
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSkill } from '@/lib/skills/registry'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { fetchUrlText } from '@/lib/marketing/fetch-url'
import { expertSourceCost, checkCredits, deductCredits, isBillableUser } from '@/lib/marketing/billing'

const MAX_SOURCES_PER_SKILL = 20

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const skillId = new URL(req.url).searchParams.get('skillId') ?? ''
  if (!skillId) return NextResponse.json({ error: 'skillId required' }, { status: 400 })

  const { data } = await supabase
    .from('builtin_expert_knowledge')
    .select('id, type, name, source_url, char_count, created_at')
    .eq('user_id', user.id)
    .eq('skill_id', skillId)
    .order('created_at', { ascending: false })

  const { features } = await getMarketingEntitlements(supabase, user.id)
  return NextResponse.json({ sources: data ?? [], canBuild: !!features.customExpertBuild })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { skillId, type, url, text, name } = await req.json()
  if (!skillId || !getSkill(skillId)) return NextResponse.json({ error: '未知的專家' }, { status: 404 })
  if (!['url', 'file', 'text'].includes(type)) {
    return NextResponse.json({ error: '不支援的來源類型' }, { status: 400 })
  }

  const { plan, features } = await getMarketingEntitlements(supabase, user.id)
  if (!features.customExpertBuild) {
    return NextResponse.json({ error: '訓練內建專家知識需 TEAM 以上方案', plan }, { status: 403 })
  }

  const { count } = await supabase
    .from('builtin_expert_knowledge')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('skill_id', skillId)
  if ((count ?? 0) >= MAX_SOURCES_PER_SKILL) {
    return NextResponse.json({ error: `每位專家最多 ${MAX_SOURCES_PER_SKILL} 筆知識來源` }, { status: 400 })
  }

  let extracted = ''
  let sourceUrl: string | null = null
  let nm = String(name ?? '').trim()
  try {
    if (type === 'url') {
      const u = String(url ?? '').trim()
      if (!u) return NextResponse.json({ error: '請輸入網址' }, { status: 400 })
      extracted = await fetchUrlText(u)
      sourceUrl = u.startsWith('http') ? u : `https://${u}`
      if (!nm) nm = sourceUrl
    } else {
      extracted = String(text ?? '').trim()
      if (!nm) nm = type === 'file' ? '上傳檔案' : '文字內容'
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }

  extracted = extracted.slice(0, 50000)
  if (!extracted) return NextResponse.json({ error: '來源沒有可用的文字內容' }, { status: 422 })

  const charCount = extracted.length
  const cost = expertSourceCost(type, charCount)
  const billable = await isBillableUser(user.id)
  const check = await checkCredits(user.id, cost, billable)
  if (!check.ok) return NextResponse.json(check.payload, { status: 402 })

  const { data, error } = await supabase
    .from('builtin_expert_knowledge')
    .insert({
      user_id: user.id, skill_id: skillId, type, name: nm,
      source_url: sourceUrl, extracted_text: extracted, char_count: charCount,
    })
    .select('id, type, name, source_url, char_count, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const deduct = await deductCredits(user.id, cost, `[builtin-expert] 知識來源（${type}）`, billable)
  return NextResponse.json({ source: data, cost, balance: deduct.ok ? deduct.balance : undefined })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await supabase.from('builtin_expert_knowledge')
    .delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
