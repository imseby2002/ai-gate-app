// 核心（跨角色共用）工具的登記表。角色專屬工具（如呼叫特定行銷 API）
// 定義在 src/lib/agents/roles/*.ts，於角色設定時與此處的核心工具合併。
import { webSearchTool } from './web_search'
import { notifyHumanTool, requestApprovalTool, finishRunTool } from './notify'
import { getCompanyContextTool } from './company_data'
import { readRoleMemoryTool, writeMemoryTool } from './memory'
import { brainstormWithModelsTool } from './brainstorm'
import type { AgentToolDef } from '../types'

export { createInternalApiTool } from './internal_api'

export const CORE_AGENT_TOOLS: Record<string, AgentToolDef> = {
  [webSearchTool.id]: webSearchTool,
  [notifyHumanTool.id]: notifyHumanTool,
  [requestApprovalTool.id]: requestApprovalTool,
  [finishRunTool.id]: finishRunTool,
  [getCompanyContextTool.id]: getCompanyContextTool,
  [readRoleMemoryTool.id]: readRoleMemoryTool,
  [writeMemoryTool.id]: writeMemoryTool,
  [brainstormWithModelsTool.id]: brainstormWithModelsTool,
}

export function isSuspendingTool(toolId: string, roleTools: Record<string, AgentToolDef>): boolean {
  return !!roleTools[toolId]?.suspending
}
