import { NextRequest, NextResponse } from 'next/server'
import { LegalAssistantEngine } from '@/lib/legal/agent'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, target_date, language, industry, province } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'query is required and must be a string' },
        { status: 400 }
      )
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
