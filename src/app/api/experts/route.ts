import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deductCredits } from '@/lib/skills/billing'
import { processExpertUrl, processExpertSearch, processExpertManual, detectSourceType } from '@/lib/experts/pipeline'

export const maxDuration = 120

// 合成一次專家知識的固定扣點（僅 external 付費用戶計費，比照 resume 工具的計價慣例）
const EXPERT_SYNTHESIS_COST = 0.05

// GET /api/experts — 列出可用專家（系統 + 自己的）
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: experts, error } = await supabase
    .from('experts')
    .select('id, name, domain, source_url, source_type, description, avatar_url, is_system, created_by, created_at, expert_knowledge(id, status, created_at)')
    .order('is_system', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ experts: experts ?? [] })
}

// POST /api/experts — 新增專家並觸發內容處理
// input_mode: 'url' | 'search' | 'manual'
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, is_active')
    .eq('id', user.id)
    .single()
  if (!profile?.is_active) return NextResponse.json({ error: 'Account suspended' }, { status: 403 })

  // 抓取 + Claude 合成有真實 API 成本 → 比照 chat/roundtable 慣例，只對 external 付費用戶計費
  const billable = profile.user_type === 'external'
  if (billable) {
    const { data: balance } = await supabase.rpc('get_credit_balance', { p_user_id: user.id })
    if ((balance ?? 0) < EXPERT_SYNTHESIS_COST) {
      return NextResponse.json({ error: 'insufficient_credits' }, { status: 402 })
    }
  }

  const body = await req.json() as {
    name: string
    domain?: string
    input_mode: 'url' | 'search' | 'manual'
    source_url?: string      // url 模式
    search_query?: string    // search 模式（選填，預設用 name）
    manual_content?: string  // manual 模式
  }

  const { name, domain, input_mode, source_url, search_query, manual_content } = body
  if (!name?.trim()) return NextResponse.json({ error: '請輸入專家名稱' }, { status: 400 })
  if (input_mode === 'url' && !source_url?.trim()) return NextResponse.json({ error: '請輸入來源 URL' }, { status: 400 })
  if (input_mode === 'manual' && !manual_content?.trim()) return NextResponse.json({ error: '請輸入內容' }, { status: 400 })

  const source_type = input_mode === 'url' && source_url ? detectSourceType(source_url) : input_mode === 'search' ? 'search' : 'manual'
  const admin = createAdminClient()

  // 建立 expert 記錄
  const { data: expert, error: expertErr } = await admin
    .from('experts')
    .insert({
      name: name.trim(),
      domain: domain?.trim() ?? null,
      source_url: source_url?.trim() ?? null,
      source_type,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (expertErr || !expert) return NextResponse.json({ error: expertErr?.message ?? '建立失敗' }, { status: 500 })

  // 建立知識記錄（status: processing）
  const { data: knowledge, error: knErr } = await admin
    .from('expert_knowledge')
    .insert({ expert_id: expert.id, status: 'processing' })
    .select('id')
    .single()
  if (knErr || !knowledge) return NextResponse.json({ error: knErr?.message ?? '建立失敗' }, { status: 500 })

  // 先扣點再處理：與 resume 工具（cover-letter / optimize）同樣的慣例，失敗不退款
  if (billable) {
    const deduct = await deductCredits(user.id, EXPERT_SYNTHESIS_COST, '[experts] synthesize')
    if (!deduct.ok && deduct.reason === 'insufficient') {
      await admin.from('experts').delete().eq('id', expert.id)
      return NextResponse.json({ error: 'insufficient_credits' }, { status: 402 })
    }
  }

  // 依模式執行 pipeline
  try {
    let raw = '', structured = ''

    if (input_mode === 'url' && source_url) {
      ;({ raw, structured } = await processExpertUrl(source_url.trim(), name.trim()))
    } else if (input_mode === 'search') {
      ;({ raw, structured } = await processExpertSearch(name.trim(), search_query?.trim() ?? ''))
    } else {
      ;({ raw, structured } = await processExpertManual(manual_content ?? '', name.trim()))
    }

    await admin
      .from('expert_knowledge')
      .update({ raw_content: raw, structured, status: 'ready', updated_at: new Date().toISOString() })
      .eq('id', knowledge.id)
    return NextResponse.json({ expertId: expert.id, status: 'ready' })
  } catch (err) {
    await admin
      .from('expert_knowledge')
      .update({ status: 'failed', error: String(err), updated_at: new Date().toISOString() })
      .eq('id', knowledge.id)
    // 刪除剛建的 expert（避免留下空殼）
    await admin.from('experts').delete().eq('id', expert.id)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
