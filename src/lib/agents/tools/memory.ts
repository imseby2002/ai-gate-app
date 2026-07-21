import type { AgentToolDef } from '../types'

export const readRoleMemoryTool: AgentToolDef<Record<string, never>> = {
  id: 'read_role_memory',
  description: '讀取此角色過去累積的長期記憶/自我檢討筆記（例如哪些做法有效、哪些活動成效不佳），規劃前建議先讀取避免重蹈覆轍。',
  inputSchema: { type: 'object', properties: {} },
  async execute(_input, ctx) {
    const memory = await ctx.getRoleMemory()
    return { memory: memory || '（尚無歷史記憶）' }
  },
}

interface WriteMemoryInput {
  type: 'note' | 'lesson' | 'preference' | 'summary'
  content: string
  tags?: string[]
  importance?: number
}

export const writeMemoryTool: AgentToolDef<WriteMemoryInput> = {
  id: 'write_memory',
  description: '寫入一筆長期記憶（例如自我檢討的心得、發現的偏好、值得記住的教訓），供未來執行時參考。',
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['note', 'lesson', 'preference', 'summary'] },
      content: { type: 'string', description: '記憶內容' },
      tags: { type: 'array', items: { type: 'string' } },
      importance: { type: 'number', description: '重要性 1-5，預設 3' },
    },
    required: ['type', 'content'],
  },
  async execute(input, ctx) {
    await ctx.writeMemory(input)
    return { ok: true }
  },
}
