import type { AgentToolDef } from '../types'

interface NotifyHumanInput {
  title: string
  body: string
  severity?: 'info' | 'warning' | 'critical'
}

export const notifyHumanTool: AgentToolDef = {
  id: 'notify_human',
  description: '主動通知真人（不需要等待回覆），例如回報進度、提醒需要注意的事項。走使用者偏好的管道（Telegram/Email/...）。',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '通知標題' },
      body: { type: 'string', description: '通知內容' },
      severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
    },
    required: ['title', 'body'],
  },
  async execute(rawInput, ctx) {
    return ctx.notifyHuman(rawInput as unknown as NotifyHumanInput)
  },
}

interface RequestApprovalInput {
  actionType: string
  summary: string
  details?: Record<string, unknown>
  riskLevel?: 'low' | 'medium' | 'high'
}

export const requestApprovalTool: AgentToolDef = {
  id: 'request_human_approval',
  description:
    '請求真人核准後才能繼續的高風險動作（花錢、簽約、對外發送訊息、撥打電話等），' +
    '也用於「只有真人能做的事」（例如開設 Facebook 粉專/LINE 官方帳號等需要真人身分驗證的平台操作）——' +
    '這種情況把 summary 寫成給真人照做的編號步驟清單。' +
    '呼叫此工具後本輪執行會暫停，等真人回覆核准/拒絕/意見（或實際完成步驟後回來核准）才會繼續。',
  inputSchema: {
    type: 'object',
    properties: {
      actionType: { type: 'string', description: "動作類型，如 'spend_money' | 'sign_contract' | 'send_external_comms' | 'make_call' | 'human_action_required'" },
      summary: { type: 'string', description: '給真人看的說明：要做什麼、為什麼；若是請真人手動操作，寫成編號步驟清單' },
      details: { type: 'object', description: '完整細節（金額、對象、內容草稿等）' },
      riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
    required: ['actionType', 'summary'],
  },
  suspending: true,
  async execute(rawInput, ctx) {
    return ctx.requestApproval(rawInput as unknown as RequestApprovalInput)
  },
}

interface FinishRunInput {
  summary: string
}

export const finishRunTool: AgentToolDef = {
  id: 'finish_run',
  description: '確認此次任務已完成（或已無法再推進），結束本次執行並附上總結報告。',
  inputSchema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: '這次執行的總結報告，會回報給真人' },
    },
    required: ['summary'],
  },
  suspending: true,
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as FinishRunInput
    await ctx.notifyHuman({
      title: `✅ 任務完成回報`,
      body: input.summary,
      severity: 'info',
    })
    return { acknowledged: true }
  },
}
