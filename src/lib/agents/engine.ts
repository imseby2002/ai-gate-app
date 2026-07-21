// 可續跑的 Agent tick 引擎。
// Vercel serverless 沒有長駐 process，因此一次「思考」被拆成有步數上限的一個 tick，
// 由 cron（/api/cron/agent-tick）或核准回覆（resumeRunAfterApproval）觸發續跑。
import { generateText, tool, jsonSchema } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAgentContext } from './runtime'
import { CORE_AGENT_TOOLS } from './tools'
import { getToolsForRole } from './roles'
import { getBalance } from '@/lib/skills/billing'
import { calculateCost } from '@/lib/ai/router'
import type { AgentToolDef } from './types'

const MAX_STEPS_PER_TICK = 4
const MAX_ATTEMPTS = 3
const TICK_MODEL_ID = 'claude-sonnet-4-6'
const SUSPENDING_TOOL_IDS = new Set(['request_human_approval', 'finish_run'])

export interface AgentRunRow {
  id: string
  user_id: string
  role_id: string
  goal: string
  input: Record<string, unknown>
  state: { log?: string[] }
  attempt_count: number
}

async function loadRole(admin: ReturnType<typeof createAdminClient>, roleId: string) {
  const { data } = await admin.from('agent_roles').select('label, description, default_model_intent').eq('id', roleId).maybeSingle()
  return data ?? { label: roleId, description: '', default_model_intent: 'analysis' }
}

async function unlock(admin: ReturnType<typeof createAdminClient>, runId: string, patch: Record<string, unknown>) {
  await admin.from('agent_runs').update({ ...patch, locked_at: null, locked_by: null }).eq('id', runId)
}

export async function tickRun(run: AgentRunRow): Promise<void> {
  const admin = createAdminClient()

  // 餘額預檢：不足直接暫停，避免執行到一半才發現扣不了款
  const balance = await getBalance(run.user_id)
  if (balance <= 0) {
    const ctx = createAgentContext(run.user_id, run.role_id, run.id)
    await ctx.notifyHuman({
      title: '⚠️ Agent 執行暫停',
      body: `角色「${run.role_id}」因點數餘額不足而暫停，請儲值後至 agent.im-tourist.com 重新啟動。`,
      severity: 'warning',
    })
    await unlock(admin, run.id, { status: 'failed', last_error: 'INSUFFICIENT_CREDITS' })
    return
  }

  const ctx = createAgentContext(run.user_id, run.role_id, run.id)
  const role = await loadRole(admin, run.role_id)
  const roleTools: Record<string, AgentToolDef> = { ...CORE_AGENT_TOOLS, ...getToolsForRole(run.role_id) }

  const aiTools: Record<string, ReturnType<typeof tool>> = {}
  for (const [id, def] of Object.entries(roleTools)) {
    aiTools[id] = tool({
      description: def.description,
      inputSchema: jsonSchema(def.inputSchema),
      execute: async (input: unknown) => {
        let output: unknown
        try {
          output = await def.execute(input, ctx)
        } catch (e) {
          output = { error: e instanceof Error ? e.message : String(e) }
        }
        await ctx.logStep({ phase: 'tool_call', toolId: id, toolInput: input, toolOutput: output })
        return output
      },
    })
  }

  const log = run.state?.log ?? []
  const priorLog = log.length ? log.join('\n\n') : '（尚未開始）'

  const systemPrompt =
    `你是公司聘用的「${role.label}」AI Agent，職責：${role.description}\n\n` +
    '規則：\n' +
    '1. 需要花錢、簽約、對外發送訊息（email/簡訊/通訊軟體/電話）等有實際影響的動作前，必須先呼叫 request_human_approval 取得真人核准，不可自行執行。\n' +
    '2. 一般查詢、分析、撰寫草稿等低風險動作可自主執行，不需事先核准。\n' +
    '3. 規劃前建議先用 get_company_context / read_role_memory 了解公司狀況與過去經驗。\n' +
    '4. 完成任務、或已無法再推進時，務必呼叫 finish_run 並附上總結報告。\n' +
    '5. 回覆使用繁體中文。'

  const prompt =
    `任務目標：${run.goal}\n\n` +
    `任務輸入：${JSON.stringify(run.input ?? {})}\n\n` +
    `目前為止的執行紀錄：\n${priorLog}\n\n` +
    '請規劃並執行下一步（可視需要呼叫工具），或在任務完成時呼叫 finish_run。'

  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY 未設定')
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const result = await generateText({
      model: anthropic(TICK_MODEL_ID),
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      tools: aiTools,
      stopWhen: ({ steps }) =>
        steps.length >= MAX_STEPS_PER_TICK ||
        steps.some(s => s.toolCalls?.some(tc => SUSPENDING_TOOL_IDS.has(tc.toolName))),
    })

    const usage = (result.usage ?? {}) as unknown as Record<string, number | undefined>
    const inputTokens = usage.inputTokens ?? usage.promptTokens ?? 0
    const outputTokens = usage.outputTokens ?? usage.completionTokens ?? 0
    const cost = calculateCost(TICK_MODEL_ID, inputTokens, outputTokens)
    if (cost > 0) await ctx.deductCredits(cost, `agent:${run.role_id}:${run.id}`)

    await ctx.logStep({
      phase: 'plan',
      thought: result.text || '(此輪僅呼叫工具，無額外文字說明)',
      modelId: TICK_MODEL_ID,
      inputTokens,
      outputTokens,
      creditsSpent: cost,
    })

    const newLogEntry = [
      result.text ? `思考：${result.text}` : '',
      ...(result.steps ?? []).flatMap(s =>
        (s.toolCalls ?? []).map(tc => `工具：${tc.toolName}（輸入：${JSON.stringify(tc.input)}）`),
      ),
    ].filter(Boolean).join('\n')

    const allToolNames = (result.steps ?? []).flatMap(s => (s.toolCalls ?? []).map(tc => tc.toolName))
    const calledApproval = allToolNames.includes('request_human_approval')
    const calledFinish = allToolNames.includes('finish_run')

    if (calledFinish) {
      await admin.from('agent_runs').update({
        state: { log: [...log, newLogEntry] },
      }).eq('id', run.id)
      await unlock(admin, run.id, { status: 'completed', completed_at: new Date().toISOString() })
      return
    }

    if (calledApproval) {
      await admin.from('agent_runs').update({
        state: { log: [...log, newLogEntry] },
      }).eq('id', run.id)
      await unlock(admin, run.id, { status: 'waiting_approval' })
      return
    }

    // 未結束也未暫停：立即排下一輪（同一分鐘內由 cron 或後續呼叫接手）
    await unlock(admin, run.id, {
      status: 'running',
      state: { log: [...log, newLogEntry] },
      attempt_count: 0,
      next_tick_at: new Date().toISOString(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const attempts = (run.attempt_count ?? 0) + 1
    await ctx.logStep({ phase: 'error', thought: message })

    if (attempts >= MAX_ATTEMPTS) {
      await ctx.notifyHuman({
        title: '❌ Agent 執行失敗',
        body: `角色「${run.role_id}」執行任務時多次失敗，已暫停：\n${message}`,
        severity: 'critical',
      })
      await unlock(admin, run.id, { status: 'paused', last_error: message, attempt_count: attempts })
    } else {
      const backoffMinutes = attempts * 2
      await unlock(admin, run.id, {
        status: 'queued',
        last_error: message,
        attempt_count: attempts,
        next_tick_at: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
      })
    }
  }
}
