import { runMultiModelDiscussion } from '../brainstorm'
import type { AgentToolDef } from '../types'

interface BrainstormInput {
  topic: string
  participants: { modelId: string; persona: string }[]
  rounds?: number
}

export const brainstormWithModelsTool: AgentToolDef = {
  id: 'brainstorm_with_models',
  description:
    '讓多個 AI 模型各自扮演不同角色/立場，針對同一主題輪流討論（例如：保守財務觀點 vs 積極行銷觀點），' +
    '最後產出討論紀錄與統整結論。適合需要多方角度評估的決策（例如評估一個新行銷專案是否可行）。',
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: '要討論的主題' },
      participants: {
        type: 'array',
        description: '參與討論的模型與其扮演角色，建議 2-4 位',
        items: {
          type: 'object',
          properties: {
            modelId: { type: 'string', description: "如 'claude-sonnet-4-5' | 'deepseek-chat' | 'gemini-2.5-flash' | 'perplexity-sonar-pro'" },
            persona: { type: 'string', description: '此參與者的角色/立場描述' },
          },
          required: ['modelId', 'persona'],
        },
      },
      rounds: { type: 'number', description: '討論輪數，預設 2' },
    },
    required: ['topic', 'participants'],
  },
  async execute(rawInput) {
    const input = rawInput as unknown as BrainstormInput
    return runMultiModelDiscussion(input.topic, input.participants, input.rounds ?? 2)
  },
}
