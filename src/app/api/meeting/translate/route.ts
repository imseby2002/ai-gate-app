import { NextRequest, NextResponse } from 'next/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

const LANG_NAMES: Record<string, string> = {
  'zh-TW': '繁體中文 (Traditional Chinese)',
  'vi': 'Tiếng Việt (Vietnamese)',
  'en': 'English',
}

function getModel() {
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    return anthropic('claude-sonnet-4-6')
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
    return google('gemini-2.5-flash')
  }
  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return openai('gpt-4o-mini')
  }
  return null
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
- Key Stores & Branches: ${stores.length ? stores.join(', ') : 'Royal, Hồ Tùng Mậu, FEELING TEA stores'}
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
   - Keep store names (e.g. "Royal", "Hồ Tùng Mậu") and person names (e.g. "chị Hà" -> "Hà 姐", "anh Tuấn", "Linh") accurate.
   - Keep brand and equipment terms precise (e.g. "FEELING TEA", "POS", "tủ đông" -> "冷凍設備/冷凍櫃", "thùng đông" -> "冷凍箱/槽").
5. If a string is already in the target language (${langName}), return it unchanged.
6. OUTPUT FORMAT: Return ONLY a valid JSON array of translated strings in the EXACT same order as the input array. No commentary or markdown formatting.`

  try {
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: JSON.stringify(texts),
      maxOutputTokens: 2000,
    })

    let arr: string[] = []
    try {
      const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
      arr = JSON.parse(cleaned)
    } catch {
      arr = []
    }

    const translations = texts.map((original, i) => (typeof arr[i] === 'string' && arr[i].trim() ? arr[i].trim() : original))
    return NextResponse.json({ translations })
  } catch (err) {
    console.error('[MeetingTranslate] generation failed:', err)
    return NextResponse.json({ translations: texts })
  }
}
