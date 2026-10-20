import { NextRequest, NextResponse } from 'next/server'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'

import { trackAiUsage } from '@/lib/ai/universal-tracker'

export const maxDuration = 60

const LANG_NAMES: Record<string, string> = {
  'zh-TW': '繁體中文 (Traditional Chinese)',
  'vi': 'Tiếng Việt (Vietnamese)',
  'en': 'English',
}

interface ModelInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any
  modelId: string
  channel: 'deepseek' | 'openrouter' | 'google' | 'openai'
}

function getModel(): ModelInstance | null {
  // 優先順位 1：DeepSeek (超低成本、高質量中文/越文翻譯)
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim()
  if (deepseekKey) {
    const deepseek = createOpenAI({
      apiKey: deepseekKey,
      baseURL: 'https://api.deepseek.com',
    })
    return { model: deepseek.chat('deepseek-chat'), modelId: 'deepseek-chat', channel: 'deepseek' }
  }

  // DeepSeek 備援：OpenRouter DeepSeek
  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = createOpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    })
    return { model: openrouter.chat('deepseek/deepseek-chat'), modelId: 'deepseek/deepseek-chat', channel: 'openrouter' }
  }

  // 優先順位 2：Google Gemini 2.5 Flash (快速、低成本備援)
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
    return { model: google('gemini-2.5-flash'), modelId: 'gemini-2.5-flash', channel: 'google' }
  }

  // 優先順位 3：OpenAI gpt-4o-mini
  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return { model: openai('gpt-4o-mini'), modelId: 'gpt-4o-mini', channel: 'openai' }
  }

  return null
}

async function translateChunk(
  chunk: string[],
  modelInstance: ModelInstance,
  systemPrompt: string
): Promise<string[]> {
  try {
    const res = await generateText({
      model: modelInstance.model,
      system: systemPrompt,
      prompt: JSON.stringify(chunk),
      maxOutputTokens: 4000,
    })

    const { text } = res
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usage = (res as any).usage ?? {}
    const inTokens = Number(usage.inputTokens ?? usage.promptTokens ?? 0)
    const outTokens = Number(usage.outputTokens ?? usage.completionTokens ?? 0)

    if (inTokens > 0 || outTokens > 0) {
      void trackAiUsage({
        feature: 'meeting',
        modelId: modelInstance.modelId,
        inputTokens: inTokens,
        outputTokens: outTokens,
        sourceChannel: modelInstance.channel,
      })
    }

    let arr: string[] = []
    try {
      const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
      arr = JSON.parse(cleaned)
    } catch {
      // 容錯救援：若 JSON 因尾端逗號或引號未閉合導致解析失敗，嘗試正規匹配已完成的字串項目
      const matches = Array.from(text.matchAll(/"((?:\\.|[^"\\])*)"/g)).map(m => m[1].replace(/\\"/g, '"'))
      if (matches.length > 0) {
        arr = matches
      }
    }

    return chunk.map((original, i) =>
      typeof arr[i] === 'string' && arr[i].trim() ? arr[i].trim() : original
    )
  } catch (err) {
    console.error('[MeetingTranslate] chunk generation failed:', err)
    return chunk
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { texts, target, context = {} } = body as {
    texts: string[]
    target: string
    context?: {
      title?: string
      department?: string
      stores?: string[]
      keywords?: string
      participants?: string[]
      history?: { speaker: string; text: string; translated?: string }[]
    }
  }

  const langName = LANG_NAMES[target]
  if (!langName || !Array.isArray(texts) || texts.length === 0) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const model = getModel()
  if (!model) {
    // 若無 AI 金鑰，直接回傳原文
    return NextResponse.json({ translations: texts })
  }

  const {
    title = '',
    department = '',
    stores = [],
    keywords = '',
    participants = [],
    history = [],
  } = context

  // 格式化前幾句對話歷史作為滑動視窗 (Sliding Context Window)
  const historyText = history
    .slice(-5)
    .map(h => `${h.speaker || 'Speaker'}: "${h.text}"${h.translated ? ` (意譯: ${h.translated})` : ''}`)
    .join('\n')

  const systemPrompt = `You are an elite bilingual business meeting interpreter for FEELING TEA (a multinational beverage & store operations enterprise).

MEETING BACKGROUND:
- Meeting Topic: ${title || '門市營運與跨部門會議 (Store Operations & Business Meeting)'}
- Department: ${department || 'General'}
- Key Stores & Branches: ${stores.length ? stores.join(', ') : '61 Yên Lãng, 20 Đội Cấn, 162 Ngọc Lâm, 53C Hai Bà Trưng, 406 Minh Khai, Royal Nguyễn Trãi, 4 Trần Thái Tông, 169 Quang Trung, 22 Khương Hạ, 217 Hồ Tùng Mậu, 155 Giảng Võ, 219C Khâm Thiên, 163 Chùa Láng, 422 Trần Khát Chân, 137 Ngọc Hồi, 128 Tân Mai, 11 Thanh Niên, 45 Cầu Gỗ, 307C Bạch Mai, 100 Phạm Ngọc Thạch'}
- Participant Names: ${participants.length ? participants.join(', ') : 'N/A'}
- Keywords & Technical Terms: ${keywords || 'None'}

RECENT DIALOGUE CONTEXT (Last few utterances in this meeting):
${historyText || '(Beginning of discussion)'}

TRANSLATION GOAL & RULES:
1. TARGET LANGUAGE: Translate each input string into ${langName}.
2. BUSINESS COHERENCE: Understand the ongoing dialogue context. Never translate fragments literally in isolation.
3. RUTHLESSLY ELIMINATE SPOKEN FILLER PARTICLES & STUTTERS:
   - Spoken Vietnamese contains heavy filler particles (e.g. "ở chứ", "thế xong rồi", "ừ đấy", "mà thế có", "nhá thế nên là", "bảo không em cứ thấy...", "thôi ư đấy", "ạ").
   - Strip out colloquial redundancy and translate into coherent, natural, and professional business language.
4. PROTECT PROPER NOUNS:
   - Keep store names (e.g. "61 Yên Lãng", "Royal Nguyễn Trãi", "217 Hồ Tùng Mậu") and person names (e.g. "chị Hà" -> "Hà 姐", "anh Tuấn", "Linh") accurate.
   - Keep brand and equipment terms precise (e.g. "FEELING TEA", "POS", "tủ đông" -> "冷凍設備/冷凍櫃", "thùng đông" -> "冷凍箱/槽").
5. If a string is already in the target language (${langName}), return it unchanged.
6. OUTPUT FORMAT: Return ONLY a valid JSON array of translated strings in the EXACT same order as the input array. No commentary or markdown formatting.`

  // 分批併行處理，每批最多 8 句，徹底杜絕 Token 超限與截斷問題
  const CHUNK_SIZE = 8
  const chunks: string[][] = []
  for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
    chunks.push(texts.slice(i, i + CHUNK_SIZE))
  }

  const results = await Promise.all(
    chunks.map(chunk => translateChunk(chunk, model, systemPrompt))
  )
  const translations = results.flat()
  return NextResponse.json({ translations })
}
