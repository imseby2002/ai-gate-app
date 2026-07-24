// Agent 核心框架的共用型別。runtime.ts / engine.ts / tools/*.ts 都以此為準。
// 註：專案未安裝 zod 為直接相依套件（僅為 ai SDK 的 peer dep），
// 故工具輸入 schema 一律用純 JSON Schema 物件（搭配 ai 套件的 jsonSchema() helper），
// 不直接 import zod，避免新增未宣告的相依套件。
import type { SkillRunContext } from '@/lib/skills/registry'

export type NotifyChannel =
  | 'telegram' | 'email' | 'line' | 'whatsapp' | 'whatsapp-personal' | 'zalo' | 'sms' | 'in_app'

export type ApprovalStatus =
  | 'pending' | 'approved' | 'rejected' | 'awaiting_feedback' | 'feedback' | 'expired' | 'cancelled'

export type AgentRunStatus =
  | 'queued' | 'running' | 'waiting_approval' | 'waiting_input' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface NotifyHumanParams {
  userId: string
  channel?: NotifyChannel
  title: string
  body: string
  severity?: 'info' | 'warning' | 'critical'
  context?: Record<string, unknown>
}

export interface NotifyHumanResult {
  ok: boolean
  channel?: NotifyChannel
  externalId?: string
  error?: string
}

export interface RequestApprovalParams {
  userId: string
  runId: string
  roleId: string
  actionType: string
  summary: string
  details?: Record<string, unknown>
  riskLevel?: 'low' | 'medium' | 'high'
  channel?: NotifyChannel
}

export interface AgentRunStepInput {
  phase: 'plan' | 'tool_call' | 'tool_result' | 'self_critique' | 'notify' | 'approval_requested' | 'approval_resolved' | 'error' | 'final_report'
  toolId?: string
  toolInput?: unknown
  toolOutput?: unknown
  thought?: string
  modelId?: string
  inputTokens?: number
  outputTokens?: number
  creditsSpent?: number
}

export interface AgentRunContext {
  userId: string
  roleId: string
  runId: string
  // 重用既有 skills runtime 的模型/生圖/生音/存檔能力
  callModel: SkillRunContext['callModel']
  generateImage: SkillRunContext['generateImage']
  generateAudio: SkillRunContext['generateAudio']
  storeFile: SkillRunContext['storeFile']
  // agent 專屬能力
  getCompanyContext(): Promise<string>
  getRoleMemory(limit?: number): Promise<string>
  writeMemory(entry: { type: 'note' | 'lesson' | 'preference' | 'summary'; content: string; tags?: string[]; importance?: number }): Promise<void>
  notifyHuman(params: Omit<NotifyHumanParams, 'userId'>): Promise<NotifyHumanResult>
  requestApproval(params: Omit<RequestApprovalParams, 'userId' | 'runId' | 'roleId'>): Promise<{ approvalId: string }>
  callInternalApi(path: string, body: Record<string, unknown>): Promise<unknown>
  logStep(entry: AgentRunStepInput): Promise<void>
  deductCredits(amount: number, description: string): Promise<void>
}

export interface AgentToolDef<TInput = Record<string, unknown>> {
  id: string
  description: string
  // 純 JSON Schema（object 型別描述），由 engine.ts 搭配 ai 套件的 jsonSchema() 包裝成 AI SDK tool
  inputSchema: Record<string, unknown>
  // suspending tool：執行後 tick 直接中斷（等真人核准），不繼續下一輪 tool round-trip
  suspending?: boolean
  execute: (input: TInput, ctx: AgentRunContext) => Promise<unknown>
}
