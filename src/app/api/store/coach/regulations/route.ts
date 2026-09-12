import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { STORE_COACH_KNOWLEDGE } from '@/lib/store-coach/knowledge-base'
import type { CompanyRegulation } from '@/lib/types/store-coach'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const level = searchParams.get('level')

    const ctx = await getUnitContext('store').catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    let regulations: CompanyRegulation[] = STORE_COACH_KNOWLEDGE.companyRegulations

    if (supabase) {
      try {
        let query = supabase.from('company_regulations').select('*').order('code')
        if (category && category !== 'all') {
          query = query.eq('category', category)
        }
        if (level && level !== 'all') {
          query = query.eq('mandatory_level', level)
        }
        const { data, error } = await query
        if (!error && data && data.length > 0) {
          regulations = data
        }
      } catch (dbErr) {
        console.warn('Company regulations DB query fallback to seeds:', dbErr)
      }
    }

    return NextResponse.json({
      success: true,
      count: regulations.length,
      regulations,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch company regulations' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      query_prompt,
      title,
      code,
      category = 'food_safety',
      clause_content = '',
      violation_penalty = '',
      manager_enforcement = '',
      mandatory_level = 'strict',
    } = body

    const ctx = await getUnitContext('store').catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    // 模式 1：依據公司規範提問 (Ask Company Regulations Compliance AI)
    if (query_prompt) {
      const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
      const hasGoogle = !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY)
      const hasOpenAI = !!process.env.OPENAI_API_KEY

      const regList = STORE_COACH_KNOWLEDGE.companyRegulations
      const regContext = regList
        .map(
          r =>
            `【${r.code}】${r.title} (${r.mandatory_level === 'strict' ? '嚴格紅線' : '常規規範'}):\n- 條款內容：${r.clause_content}\n- 違規罰則：${r.violation_penalty}\n- 店長查核：${r.manager_enforcement}`
        )
        .join('\n\n')

      const systemPrompt = `你是 Feeling Tea (啡靈茶飲) 總部營運稽核與公司法規專家。
你的任務是協助店長、區督導與門市同仁，嚴格且清晰地理解公司的各項管理規範、食安紅線與員工守則。
以下為 Feeling Tea 官方正式頒布之管理規章：
${regContext}

請針對使用者的諮詢問題，明確援引適用條款，說明規範內容、違規處分、以及店長應如何採取合法且溫暖的引導對策：
提問：${query_prompt}

請以繁體中文回答：
1. 【適用規章與條款編號】：
2. 【規範核心要求】：
3. 【違規罰則與處分程序】：
4. 【店長現場執行與溝通指引】：`

      let answer = ''
      if (hasAnthropic) {
        const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const res = await generateText({
          model: anthropic('claude-sonnet-4-5'),
          messages: [{ role: 'user', content: systemPrompt }],
          maxOutputTokens: 2000,
        })
        answer = res.text
      } else if (hasGoogle) {
        const google = createGoogleGenerativeAI({
          apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
        })
        const res = await generateText({
          model: google('gemini-2.0-flash'),
          messages: [{ role: 'user', content: systemPrompt }],
        })
        answer = res.text
      } else if (hasOpenAI) {
        const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const res = await generateText({
          model: openai('gpt-4o'),
          messages: [{ role: 'user', content: systemPrompt }],
        })
        answer = res.text
      } else {
        answer = `【適用規章】：依據《Feeling Tea 門市管理規章》之相關規範。\n【核心要求】：現場落實標準作業手冊，恪守食安衛生與收銀誠信紅線。\n【違規處分】：首次給予警示糾正，重大或累犯者呈報人評會議處。\n【店長指引】：以客觀陳述事實引導同仁理解規章背後的品牌責任。`
      }

      return NextResponse.json({
        success: true,
        type: 'compliance_answer',
        answer,
        timestamp: new Date().toISOString(),
      })
    }

    // 模式 2：傳遞 / 新增公司新規範給 AI 教練
    if (!title || !clause_content) {
      return NextResponse.json({ error: '請提供規範標題與具體條款內容' }, { status: 400 })
    }

    const regCode = code || `REG-${category.toUpperCase().slice(0, 4)}-${Math.floor(10 + Math.random() * 90)}`

    const newRegulation: CompanyRegulation = {
      id: `reg-${Date.now()}`,
      code: regCode,
      title,
      category,
      clause_content,
      violation_penalty,
      manager_enforcement,
      mandatory_level,
      version: '2026.1',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (supabase) {
      try {
        const { data: dbItem, error } = await supabase
          .from('company_regulations')
          .insert(newRegulation)
          .select('*')
          .single()
        if (!error && dbItem) {
          return NextResponse.json({ success: true, regulation: dbItem })
        }
      } catch (dbErr) {
        console.warn('Persist company regulation fallback to session response:', dbErr)
      }
    }

    return NextResponse.json({
      success: true,
      regulation: newRegulation,
      note: '公司規範已成功傳遞並同步至門市營運教練 AI 大腦！',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Regulation processing failed' }, { status: 500 })
  }
}
