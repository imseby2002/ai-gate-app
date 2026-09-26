// 目標任務（Mission）執行工具：操作 marketing.im-tourist.com 內部資源、回報 KPI、外部採購申請、排定下次檢查。
// 行銷資料一律寫入 mission.owner_id（公司 owner）名下，與行銷中心頁面看到的是同一份資料。
import { createAdminClient } from '@/lib/supabase/admin'
import { buildMarketingInventory, loadMission, type MissionRow } from '../missions'
import { generateContentSet } from '@/lib/mkt/generate'
import { buildMktSnapshot } from '@/lib/mkt/analytics'
import type { AgentRunContext, AgentToolDef } from '../types'

async function missionForRun(ctx: AgentRunContext): Promise<MissionRow> {
  const admin = createAdminClient()
  const { data: run } = await admin.from('agent_runs').select('mission_id').eq('id', ctx.runId).maybeSingle()
  const mission = run?.mission_id ? await loadMission(admin, run.mission_id as string) : null
  if (!mission) throw new Error('此執行未綁定目標任務，無法使用此工具')
  return mission
}

// 非 mission run 的行銷工具退回用：以使用者本人為資料歸屬
async function ownerForRun(ctx: AgentRunContext): Promise<string> {
  const admin = createAdminClient()
  const { data: run } = await admin.from('agent_runs').select('mission_id').eq('id', ctx.runId).maybeSingle()
  if (run?.mission_id) {
    const mission = await loadMission(admin, run.mission_id as string)
    if (mission) return mission.owner_id
  }
  return ctx.userId
}

const CONTENT_CHANNELS = ['fb', 'ig', 'tiktok', 'zalo', 'line']
const CALENDAR_CHANNELS = ['fb', 'ig', 'tiktok', 'zalo', 'line', 'store', 'other']

export const listMarketingResourcesTool: AgentToolDef = {
  id: 'list_marketing_resources',
  description: '盤點 marketing.im-tourist.com 既有資源：品牌檔、商品、已產出內容、未來排程、進行中活動、外送通路，以及哪些能自動化、哪些需要外部/真人。',
  inputSchema: { type: 'object', properties: {}, required: [] },
  async execute(_input, ctx) {
    const admin = createAdminClient()
    return buildMarketingInventory(admin, await ownerForRun(ctx))
  },
}

export const getMarketingSnapshotTool: AgentToolDef = {
  id: 'get_marketing_snapshot',
  description: '讀取行銷成效快照：外送各平台訂單/營收、行銷支出、內容產出與已發佈數、損益表營收與廣告費。用於衡量業績成長類 KPI。',
  inputSchema: { type: 'object', properties: {}, required: [] },
  async execute(_input, ctx) {
    const admin = createAdminClient()
    return buildMktSnapshot(admin, await ownerForRun(ctx))
  },
}

interface CreateContentInput { topic: string; brief?: string; channels?: string[] }

export const createContentSetTool: AgentToolDef = {
  id: 'create_content_set',
  description: '依品牌守則一次產出整套內容（指定平台文案＋hashtags、短影音腳本、生圖提示、GEO 文章），存入行銷中心內容庫（狀態：已核准，待發佈）。',
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: '主題／新品／活動' },
      brief: { type: 'string', description: '補充說明：目標受眾、優惠、要強調的賣點、對應的計畫任務 id' },
      channels: { type: 'array', items: { type: 'string', enum: CONTENT_CHANNELS } },
    },
    required: ['topic'],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as CreateContentInput
    const admin = createAdminClient()
    const ownerId = await ownerForRun(ctx)
    const channels = (input.channels ?? []).filter(c => CONTENT_CHANNELS.includes(c))
    const { outputs, model } = await generateContentSet(admin, ownerId, input.topic, input.brief ?? '', channels)
    const { data, error } = await admin.from('mkt_content').insert({
      owner_id: ownerId,
      topic: input.topic,
      brief: input.brief ?? '',
      channels,
      outputs,
      status: 'approved',
      model,
      review_note: `AI Agent 依已核准計畫產出（run ${ctx.runId}）`,
    }).select('id').single()
    if (error) throw new Error(error.message)
    return { contentId: data.id, outputs }
  },
}

interface ScheduleContentInput { title: string; channel: string; scheduled_date: string; note?: string }

export const scheduleContentTool: AgentToolDef = {
  id: 'schedule_content',
  description: '把內容排入行銷中心的內容行事曆（狀態：已排程）。note 請附內容 id 與發佈重點，方便真人或後續串接依排程發佈。',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      channel: { type: 'string', enum: CALENDAR_CHANNELS },
      scheduled_date: { type: 'string', description: 'YYYY-MM-DD' },
      note: { type: 'string' },
    },
    required: ['title', 'channel', 'scheduled_date'],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as ScheduleContentInput
    const admin = createAdminClient()
    const { data, error } = await admin.from('mkt_calendar').insert({
      owner_id: await ownerForRun(ctx),
      title: input.title,
      channel: CALENDAR_CHANNELS.includes(input.channel) ? input.channel : 'other',
      scheduled_date: input.scheduled_date || null,
      status: 'scheduled',
      note: input.note ?? '',
    }).select('id').single()
    if (error) throw new Error(error.message)
    return { calendarId: data.id }
  },
}

interface ReportProgressInput { note: string; kpi_updates?: { key: string; current: number; source: string }[] }

export const reportMissionProgressTool: AgentToolDef = {
  id: 'report_mission_progress',
  description: '回報目標任務進度：寫一筆進度紀錄，並更新 KPI 實際值（current 必須來自工具結果或真人回報，source 寫明出處）。',
  inputSchema: {
    type: 'object',
    properties: {
      note: { type: 'string', description: '本次完成了什麼、下一步' },
      kpi_updates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: '計畫書 KPI 的 key' },
            current: { type: 'number' },
            source: { type: 'string', description: '數據出處' },
          },
          required: ['key', 'current', 'source'],
        },
      },
    },
    required: ['note'],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as ReportProgressInput
    const admin = createAdminClient()
    const mission = await missionForRun(ctx)
    const now = new Date().toISOString()
    const updates = input.kpi_updates ?? []
    const kpis = (mission.kpis ?? []).map(k => {
      const u = updates.find(x => x.key === k.key)
      return u ? { ...k, current: Number(u.current), source: u.source, updated_at: now } : k
    })
    const unknown = updates.filter(u => !kpis.some(k => k.key === u.key)).map(u => u.key)
    const progress_log = [
      ...(mission.progress_log ?? []),
      { at: now, note: input.note, kpi_updates: Object.fromEntries(updates.map(u => [u.key, Number(u.current)])) },
    ].slice(-200)
    const { error } = await admin.from('agent_missions').update({ kpis, progress_log }).eq('id', mission.id)
    if (error) throw new Error(error.message)
    return { ok: true, kpis, unknownKpiKeys: unknown }
  },
}

interface ExternalPurchaseInput { vendor: string; description: string; amount: number; url?: string; reason: string; how_to_execute?: string }

export const requestExternalPurchaseTool: AgentToolDef = {
  id: 'request_external_purchase',
  description:
    '內部資源不足時，申請動用預算採購外部資源（廣告投放、KOL、外包設計、媒體曝光等）。' +
    '會檢查剩餘預算，超過直接拒絕；未超過則送真人核准，本輪暫停，核准後才可動用。',
  inputSchema: {
    type: 'object',
    properties: {
      vendor: { type: 'string', description: '廠商/平台名稱' },
      description: { type: 'string', description: '採購內容與規格' },
      amount: { type: 'number', description: '金額（任務預算幣別）' },
      url: { type: 'string', description: '廠商/報價網址' },
      reason: { type: 'string', description: '為何內部資源做不到、預期帶來的 KPI 效果' },
      how_to_execute: { type: 'string', description: '核准後的執行方式（自動或需真人操作的步驟）' },
    },
    required: ['vendor', 'description', 'amount', 'reason'],
  },
  suspending: true,
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as ExternalPurchaseInput
    const admin = createAdminClient()
    const mission = await missionForRun(ctx)
    const amount = Number(input.amount)
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: '金額必須大於 0' }

    const { data: pending } = await admin
      .from('agent_mission_expenses')
      .select('amount')
      .eq('mission_id', mission.id)
      .eq('status', 'proposed')
    const pendingTotal = (pending ?? []).reduce((t, e) => t + Number(e.amount), 0)
    const remaining = Number(mission.budget_amount) - Number(mission.budget_spent) - pendingTotal
    if (amount > remaining) {
      return { ok: false, error: `超出剩餘預算（剩餘 ${remaining} ${mission.budget_currency}，含待核准中的申請），請調整方案或改用內部資源` }
    }

    const { data: expense, error } = await admin.from('agent_mission_expenses').insert({
      mission_id: mission.id,
      vendor: input.vendor,
      description: input.description,
      amount,
      url: input.url ?? null,
      note: input.reason,
    }).select('id').single()
    if (error || !expense) throw new Error(error?.message ?? '建立採購申請失敗')

    const summary =
      `💰 外部採購申請（目標：${mission.objective}）\n` +
      `廠商：${input.vendor}\n內容：${input.description}\n金額：${amount} ${mission.budget_currency}\n` +
      (input.url ? `網址：${input.url}\n` : '') +
      `理由：${input.reason}\n` +
      (input.how_to_execute ? `核准後執行方式：${input.how_to_execute}\n` : '') +
      `預算：總 ${mission.budget_amount}／已動用 ${mission.budget_spent}／核准後剩餘 ${remaining - amount}`

    const { approvalId } = await ctx.requestApproval({
      actionType: 'external_purchase',
      summary,
      details: { expenseId: expense.id, missionId: mission.id, ...input },
      riskLevel: 'high',
    })
    await admin.from('agent_mission_expenses').update({ approval_id: approvalId }).eq('id', expense.id)
    return { status: 'awaiting_human_approval', approvalId, expenseId: expense.id }
  },
}

interface ScheduleNextCheckInput { hours: number; reason: string }

export const scheduleNextCheckTool: AgentToolDef = {
  id: 'schedule_next_check',
  description: '目前階段已做完、需要等時間經過（曝光累積、下一階段開始、等數據）時使用：暫停到指定小時數後自動繼續（1–336 小時）。',
  inputSchema: {
    type: 'object',
    properties: {
      hours: { type: 'number', description: '幾小時後繼續，1–336' },
      reason: { type: 'string', description: '要等什麼、醒來後要做什麼' },
    },
    required: ['hours', 'reason'],
  },
  suspending: true,
  async execute(rawInput) {
    const input = rawInput as unknown as ScheduleNextCheckInput
    const hours = Math.min(336, Math.max(1, Number(input.hours) || 24))
    return { ok: true, resumeAt: new Date(Date.now() + hours * 3600_000).toISOString() }
  },
}

export const MISSION_CORE_TOOLS: Record<string, AgentToolDef> = {
  [reportMissionProgressTool.id]: reportMissionProgressTool,
  [requestExternalPurchaseTool.id]: requestExternalPurchaseTool,
  [scheduleNextCheckTool.id]: scheduleNextCheckTool,
}

export const MARKETING_EXECUTION_TOOLS: Record<string, AgentToolDef> = {
  [listMarketingResourcesTool.id]: listMarketingResourcesTool,
  [getMarketingSnapshotTool.id]: getMarketingSnapshotTool,
  [createContentSetTool.id]: createContentSetTool,
  [scheduleContentTool.id]: scheduleContentTool,
}
