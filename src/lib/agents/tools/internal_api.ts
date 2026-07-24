// 把既有內部 API route 包裝成 agent 工具的工廠函式。
// 刻意不做成「任意 path + 任意 body」的單一泛用工具（風險太高、LLM 容易誤用）；
// 每個角色改用此工廠針對特定 route 建立專用工具（見 src/lib/agents/roles/*.ts）。
import type { AgentToolDef } from '../types'

export function createInternalApiTool(
  id: string,
  description: string,
  path: string,
  inputSchema: Record<string, unknown>,
): AgentToolDef {
  return {
    id,
    description,
    inputSchema,
    async execute(input, ctx) {
      return ctx.callInternalApi(path, input as Record<string, unknown>)
    },
  }
}
