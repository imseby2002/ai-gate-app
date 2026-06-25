import { NextRequest, NextResponse } from 'next/server'
import { getCronOrUserAuth } from '@/lib/cron-auth'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { langInstruction } from '@/lib/marketing/lang'

export const maxDuration = 60

const PersonaSchema = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  sentimentScore: z.number(),
  reaction: z.string(),
  keyResonance: z.array(z.string()),
  keyObjections: z.array(z.string()),
  socialBehavior: z.enum(['share', 'like', 'comment_positive', 'ignore', 'comment_negative', 'report']),
  influenceScore: z.number(),
  coalition: z.string().optional(),
})

const SimulationSchema = z.object({
  summary: z.string(),
  personas: z.array(PersonaSchema),
  coalitions: z.array(z.object({
    name: z.string(),
    memberIds: z.array(z.string()),
    stance: z.string(),
    percentage: z.number(),
    isSupporter: z.boolean(),
  })),
  crisisRisks: z.array(z.object({
    topic: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    description: z.string(),
    triggerPersonas: z.array(z.string()),
  })),
  resonancePoints: z.array(z.object({
    message: z.string(),
    impact: z.enum(['high', 'medium', 'low']),
    targetPersonas: z.array(z.string()),
  })),
  overallSentiment: z.number(),
  predictedSpread: z.object({
    organic: z.number(),
    negative: z.number(),
    neutral: z.number(),
  }),
  recommendation: z.string(),
})

export type SimulationResult = z.infer<typeof SimulationSchema>

export async function POST(req: NextRequest) {
  try {
    const authUser = await getCronOrUserAuth(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      content,
      companyData,
      collectedData,
      analysisData,
      personaCount = 10,
      scenario,
      language,
    } = body

    const parts: string[] = []
    if (companyData?.companyName) {
      parts.push(
        `【公司資料】\n公司：${companyData.companyName}\n產業：${companyData.industry ?? ''}\n產品：${companyData.products ?? ''}\n目標客群：${companyData.targetAudience ?? ''}\n競爭優勢：${companyData.competitiveAdvantage ?? ''}`
      )
    }
    if (collectedData) {
      parts.push(`【市場蒐集資料】\n${String(collectedData).slice(0, 2500)}`)
    }
    if (analysisData?.results) {
      const txt = Object.entries(analysisData.results as Record<string, string>)
        .map(([k, v]) => `${k}:\n${v}`)
        .join('\n\n')
        .slice(0, 2500)
      parts.push(`【市場分析】\n${txt}`)
    }
    if (content) {
      parts.push(`【行銷內容】\n${String(content).slice(0, 2500)}`)
    }

    const inputContent = parts.join('\n\n')
    if (!inputContent.trim()) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 })
    }

    const scenarioText = scenario?.trim()
      ? `\n\n【情境注入】在模擬中加入以下假設：${scenario}\n請標記哪些 Persona 因此改變立場，以及陣營如何重組。`
      : ''

    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: 0 } },
      },
      schema: SimulationSchema,
      prompt: `你是一個專業行銷消費者模擬引擎（參考 OASIS 多智能體社會模擬系統）。

根據以下資料，生成 ${personaCount} 個不同消費族群 Persona 並模擬對此行銷活動的反應：

${inputContent}
${scenarioText}

Persona 類型需多樣化，需涵蓋（不限於）：精打細算型、品牌忠誠型、科技愛好者、意見領袖型、保守觀望型、衝動消費型、環保意識型、社群追蹤型、批判分析型。

要求：
1. 每個 Persona 有明確情感分數（-100到100）、社群行為傾向、共鳴點與疑慮
2. 識別哪些 Persona 形成支持或反對陣營（coalition），各陣營需標注立場與人數佔比
3. 找出可能引發公關危機的議題，標注嚴重程度（low/medium/high）
4. 提取最能引起共鳴的核心行銷訊息（依影響力高低排列）
5. 預測社群媒體傳播效應（organic + negative + neutral 三者加總 = 100）

${langInstruction(language)} Persona ID 格式：p1, p2, p3...`,
    })

    return NextResponse.json(object)
  } catch (err) {
    console.error('[simulate]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
