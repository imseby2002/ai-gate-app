/**
 * POST /api/marketing/experts/[id]/sources — 新增知識來源並萃取文字（需 customExpertBuild）
 *   Body: { type: 'url' | 'text', name?, url?, text? }
 *   （檔案類型：前端先呼叫 /api/marketing/upload-file 取得 textContent，再以 type='text' 送入）
 * 依萃取字數＋來源類型扣點（訓練成本）。admin/employee 不計費。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { fetchUrlText } from '@/lib/marketing/fetch-url'
import { expertSourceCost, checkCredits, deductCredits, isBillableUser } from '@/lib/marketing/billing'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, features } = await getMarketingEntitlements(supabase, user.id)
  if (!features.customExpertBuild) {
    return NextResponse.json({ error: '訓練自製專家需 TEAM 以上方案', plan }, { status: 403 })
  }

  // 確認專家存在且屬於自己（RLS）
  const { data: expert } = await supabase
    .from('marketing_experts').select('id').eq('id', id).single()
  if (!expert) return NextResponse.json({ error: '找不到專家' }, { status: 404 })

  const body = await req.json()
  const type = body.type as 'url' | 'file' | 'text'
  if (!['url', 'file', 'text'].includes(type)) {
    return NextResponse.json({ error: '不支援的來源類型' }, { status: 400 })
  }

  let extracted = ''
  let name = String(body.name ?? '').trim()
  let sourceUrl: string | null = null

  try {
    if (type === 'url') {
      const url = String(body.url ?? '').trim()
      if (!url) return NextResponse.json({ error: '請輸入網址' }, { status: 400 })
      extracted = await fetchUrlText(url)
      sourceUrl = url.startsWith('http') ? url : `https://${url}`
      if (!name) name = sourceUrl
    } else {
      // file（前端已萃取）或 text：都以純文字送入
      extracted = String(body.text ?? '').trim()
      sourceUrl = body.url ? String(body.url) : null
      if (!name) name = type === 'file' ? '上傳檔案' : '文字內容'
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }

  extracted = extracted.slice(0, 50000)
  if (!extracted) {
    return NextResponse.json({ error: '來源沒有可用的文字內容' }, { status: 422 })
  }

  const charCount = extracted.length
  const cost = expertSourceCost(type, charCount)
  const billable = await isBillableUser(user.id)
  const check = await checkCredits(user.id, cost, billable)
  if (!check.ok) return NextResponse.json(check.payload, { status: 402 })

  const { data, error } = await supabase
    .from('marketing_expert_sources')
    .insert({
      expert_id: id,
      user_id: user.id,
      type,
      name,
      source_url: sourceUrl,
      extracted_text: extracted,
      char_count: charCount,
    })
    .select('id, type, name, source_url, char_count, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('marketing_experts')
    .update({ updated_at: new Date().toISOString() }).eq('id', id)
  const deduct = await deductCredits(user.id, cost, `[marketing] 自製專家訓練來源（${type}）`, billable)

  return NextResponse.json({ source: data, cost, balance: deduct.ok ? deduct.balance : undefined })
}
