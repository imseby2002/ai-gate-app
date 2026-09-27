import { NextRequest, NextResponse } from 'next/server'
import { LegalAssistantEngine } from '@/lib/legal/agent'
import { createClient } from '@/lib/supabase/server'
import { getModuleEntitlements, consumeMonthlyQuota, quotaExceededResponse } from '@/lib/module-plans/entitlements'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { query, target_date, language, industry, province } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'query is required and must be a string' },
        { status: 400 }
      )
    }

    // 法規問答每月次數依法律合規方案（內部帳號為 MAX 不限）
    const ent = await getModuleEntitlements(user.id, 'legal')
    if (!await consumeMonthlyQuota(user.id, 'legal', 'qa', ent.features.qaMonthlyLimit)) {
      return quotaExceededResponse(`本月法規問答 ${ent.features.qaMonthlyLimit} 次已用完，CORE 以上不限次數`, ent.plan)
    }

    const engine = new LegalAssistantEngine()
    const answer = await engine.answerLegalQuery({
      query,
      target_date,
      language: language || 'zh',
      industry,
      province,
    })

    const markdown = engine.formatAnswerMarkdown(answer)

    return NextResponse.json({
      success: true,
      data: answer,
      formatted_markdown: markdown,
    })
  } catch (error) {
    console.error('[API /api/legal/query] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error while processing legal query' },
      { status: 500 }
    )
  }
}
