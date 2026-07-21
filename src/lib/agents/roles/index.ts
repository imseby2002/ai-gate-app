// 各角色的專屬工具集（核心工具見 src/lib/agents/tools/index.ts 的 CORE_AGENT_TOOLS）。
// Phase 1 試點角色（lead-gen、marketing-officer）在此登記，其餘角色之後陸續加入。
import type { AgentToolDef } from '../types'

export const ROLE_TOOL_SETS: Record<string, Record<string, AgentToolDef>> = {}

export function getToolsForRole(roleId: string): Record<string, AgentToolDef> {
  return ROLE_TOOL_SETS[roleId] ?? {}
}
