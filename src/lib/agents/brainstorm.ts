// 多 AI 腦力激盪：讓不同模型扮演不同角色針對同一主題輪流發言，
// 供「專案行銷專員」「研究員」等角色的 brainstorm_with_models 工具使用。
// 不重造模型呼叫邏輯，直接派工給既有的 src/lib/ai/providers/*。
import { streamClaude } from '@/lib/ai/providers/claude'
import { streamDeepSeek } from '@/lib/ai/providers/deepseek'
import { streamGemini } from '@/lib/ai/providers/gemini'
import { streamPerplexity } from '@/lib/ai/providers/perplexity'
import { getProviderFromModel } from '@/lib/ai/router'
import type { ChatParams } from '@/lib/ai/providers/deepseek'

export interface BrainstormParticipant {
  modelId: string   // 例如 'claude-sonnet-4-5' | 'deepseek-chat' | 'gemini-2.5-flash' | 'perplexity-sonar-pro'
  persona: string    // 此參與者扮演的角色/觀點，例如「保守的財務長，重視風險與成本」
}

export interface BrainstormTurn {
  round: number
  modelId: string
  persona: string
  text: string
}

async function callByModelId(params: ChatParams): Promise<string> {
  const provider = getProviderFromModel(params.modelId)
  const stream =
    provider === 'anthropic'  ? await streamClaude(params) :
    provider === 'google'     ? await streamGemini(params) :
    provider === 'perplexity' ? await streamPerplexity(params) :
    await streamDeepSeek(params)
  return stream.text
}

/**
 * 讓多個模型（各自扮演一個 persona）針對同一主題輪流發言，
 * 每輪都能看到前一輪所有人的發言，最後由第一位參與者的模型統整結論。
 */
export async function runMultiModelDiscussion(
  topic: string,
  participants: BrainstormParticipant[],
  rounds = 2,
): Promise<{ transcript: BrainstormTurn[]; synthesis: string }> {
  if (participants.length === 0) throw new Error('至少需要一位參與者')

  const transcript: BrainstormTurn[] = []

  for (let round = 1; round <= rounds; round++) {
    for (const p of participants) {
      const priorContext = transcript
        .map(t => `【第${t.round}輪・${t.persona}】\n${t.text}`)
        .join('\n\n')
      const systemPrompt =
        `你正在參與一場多方腦力激盪會議，你的角色是：${p.persona}。\n` +
        `請從你的角色觀點發言，具體、有立場，可以質疑或補充其他人的看法，避免空泛附和。回覆控制在 300 字內。`
      const prompt = priorContext
        ? `討論主題：${topic}\n\n目前為止的發言紀錄：\n${priorContext}\n\n請就以上內容，以你的角色觀點發表這一輪的看法。`
        : `討論主題：${topic}\n\n請以你的角色觀點，率先發表看法。`

      const text = await callByModelId({
        modelId: p.modelId,
        systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 800,
      })
      transcript.push({ round, modelId: p.modelId, persona: p.persona, text })
    }
  }

  const fullTranscript = transcript.map(t => `【第${t.round}輪・${t.persona}】\n${t.text}`).join('\n\n')
  const synthesis = await callByModelId({
    modelId: participants[0].modelId,
    systemPrompt: '你是會議記錄整理者，請針對以下多方討論紀錄，整理出：①共識點 ②主要分歧 ③建議的下一步行動。以繁體中文條列輸出。',
    messages: [{ role: 'user', content: `討論主題：${topic}\n\n完整發言紀錄：\n${fullTranscript}` }],
    maxTokens: 1200,
  })

  return { transcript, synthesis }
}
