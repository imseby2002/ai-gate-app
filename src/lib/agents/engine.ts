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
// 連續錯誤有 MAX_ATTEMPTS 擋著，但一個不出錯、只是一直不呼叫 finish_run／不觸發
// 核准的 run 不會被那個機制擋下，會被 cron 每分鐘一直撿起來無限期執行，唯一煞車
// 是點數歸零。這裡加一個總 tick 次數上限，不論成功或失敗都算，超過就暫停通知真人。
const MAX_TOTAL_TICKS = 50
const TICK_MODEL_ID = 'claude-sonnet-4-6'
// 這兩個工具本身就是「請求核准/結束」的機制，不需要再被硬性核准關卡包一層
const SELF_SUSPENDING_TOOL_IDS = new Set(['request_human_approval', 'finish_run'])

export interface AgentRunRow {
  id: string
  user_id: string
  role_id: string
  goal: string
  input: Record<string, unknown>
  state: { log?: string[]; pendingToolCalls?: { toolId: string; input: unknown; approvalId: string }[] }
  attempt_count: number
  tick_count: number
  trigger_type: string
}

async function loadRole(admin: ReturnType<typeof createAdminClient>, roleId: string) {
  const { data } = await admin.from('agent_roles').select('label, description, default_model_intent').eq('id', roleId).maybeSingle()
  return data ?? { label: roleId, description: '', default_model_intent: 'analysis' }
}

async function unlock(admin: ReturnType<typeof createAdminClient>, runId: string, patch: Record<string, unknown>) {
  await admin.from('agent_runs').update({ ...patch, locked_at: null, locked_by: null }).eq('id', runId)
}

// 硬性核准關卡：查此角色每個工具是否需要核准（agent_role_tools 覆蓋值優先，否則用 agent_tools 的全站預設）。
// 目前 Phase 1 種子的工具（web_search / collect_market_data / draft_marketing_copy 等）皆為草稿/唯讀動作，
// default_requires_approval 全為 false；Phase 2 起若新增「真的會送出」的工具（寄信、下單），
// 只要在 agent_tools 種入 default_requires_approval = true，這裡就會自動幫它掛上核准關卡，
// 不必依賴模型自己記得呼叫 request_human_approval。
async function loadApprovalRequirements(
  admin: ReturnType<typeof createAdminClient>,
  roleId: string,
  toolIds: string[],
): Promise<Map<string, boolean>> {
  const [{ data: toolDefaults }, { data: overrides }] = await Promise.all([
    admin.from('agent_tools').select('id, default_requires_approval').in('id', toolIds),
    admin.from('agent_role_tools').select('tool_id, requires_approval_override').eq('role_id', roleId).in('tool_id', toolIds),
  ])
  const map = new Map<string, boolean>()
  for (const t of toolDefaults ?? []) map.set(t.id, !!t.default_requires_approval)
  for (const o of overrides ?? []) {
    if (o.requires_approval_override !== null) map.set(o.tool_id, !!o.requires_approval_override)
  }
  return map
}

export async function tickRun(run: AgentRunRow): Promise<void> {
  const admin = createAdminClient()

  // 總 tick 次數上限：在花任何 LLM 成本之前就先擋，避免一直不收斂的 run 無限期跑下去
  const tickCount = (run.tick_count ?? 0) + 1
  if (tickCount > MAX_TOTAL_TICKS) {
    const ctx = createAgentContext(run.user_id, run.role_id, run.id)
    await ctx.notifyHuman({
      title: '⚠️ Agent 執行已達上限',
      body: `角色「${run.role_id}」已執行 ${MAX_TOTAL_TICKS} 輪仍未完成，為避免無限消耗點數已自動暫停，請至 agent.im-tourist.com 檢查執行紀錄後手動繼續或結束。`,
      severity: 'warning',
    })
    await unlock(admin, run.id, { status: 'paused', last_error: 'MAX_TICKS_EXCEEDED', tick_count: tickCount })
    return
  }
  await admin.from('agent_runs').update({ tick_count: tickCount }).eq('id', run.id)

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
  const approvalRequirements = await loadApprovalRequirements(admin, run.role_id, Object.keys(roleTools))

  let log = run.state?.log ?? []
  let pendingToolCalls = run.state?.pendingToolCalls ?? []

  try {
    // ── 若上一輪是等待核准，本輪先把真人的回覆結果寫進紀錄，再繼續規劃 ──
    // 涵蓋兩種情況：(1) 模型自己呼叫 request_human_approval 純徵詢意見、
    // (2) 某個受硬性核准關卡管制的工具被擋下，核准後這裡才真正執行它。
    // 同一輪若有多個工具同時被擋下，各自用 approvalId 精準比對自己的核准結果，
    // 而不是抓「最新一筆已回覆」——否則先核准的那筆會被後核准的蓋掉、永遠不會真的執行。
    if (run.trigger_type === 'followup_approval') {
      if (pendingToolCalls.length) {
        const { data: approvals } = await admin
          .from('agent_approvals')
          .select('id, status, feedback')
          .in('id', pendingToolCalls.map(p => p.approvalId))
        const approvalById = new Map((approvals ?? []).map(a => [a.id, a]))

        const stillPending: typeof pendingToolCalls = []
        for (const call of pendingToolCalls) {
          const approval = approvalById.get(call.approvalId)
          if (!approval || approval.status === 'pending' || approval.status === 'awaiting_feedback') {
            stillPending.push(call) // 這筆還沒回覆，留到下一輪繼續等
            continue
          }
          const gatedDef = roleTools[call.toolId]
          if (approval.status === 'approved' && gatedDef) {
            let output: unknown
            try {
              output = await gatedDef.execute(call.input as Record<string, unknown>, ctx)
            } catch (e) {
              output = { error: e instanceof Error ? e.message : String(e) }
            }
            await ctx.logStep({ phase: 'tool_result', toolId: call.toolId, toolInput: call.input, toolOutput: output })
            log = [...log, `✅ 真人已核准並執行：${call.toolId}（輸入：${JSON.stringify(call.input)}）\n結果：${JSON.stringify(output)}`]
          } else if (approval.status === 'rejected') {
            log = [...log, `❌ 真人拒絕執行：${call.toolId}${approval.feedback ? `（意見：${approval.feedback}）` : ''}`]
          } else {
            log = [...log, `✏️ 真人回覆意見：${approval.feedback ?? '（無文字意見）'}，請依此調整後續做法（原欲執行：${call.toolId}）`]
          }
        }

        // 還有工具的核准尚未回覆：先把已處理的部分寫回紀錄，繼續等，不急著花錢規劃下一步
        if (stillPending.length) {
          await unlock(admin, run.id, {
            status: 'waiting_approval',
            state: { log, pendingToolCalls: stillPending },
          })
          return
        }
        pendingToolCalls = []
      } else {
        // 模型自己呼叫 request_human_approval 徵詢意見的情況：把結果原樣寫進紀錄供模型參考
        const { data: approval } = await admin
          .from('agent_approvals')
          .select('status, feedback')
          .eq('run_id', run.id)
          .not('responded_at', 'is', null)
          .order('responded_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()
        if (approval) {
          const outcomeLabel = approval.status === 'approved' ? '✅ 已核准' : approval.status === 'rejected' ? '❌ 已拒絕' : '✏️ 已回覆意見'
          log = [...log, `真人回覆：${outcomeLabel}${approval.feedback ? `：${approval.feedback}` : ''}`]
        }
      }
    }

    // 本輪呼叫到的、被核准關卡擋下的工具（可能不只一個：模型可能在同一輪同時呼叫多個受管制工具）
    const gatedCallsThisTick: { toolId: string; input: unknown; approvalId: string }[] = []

    // 每個 tool() 呼叫的輸入/輸出型別都不同（來自各自的 JSON Schema），
    // 這裡刻意用 any 收斂成單一 map 傳給 generateText({ tools }) —
    // 個別工具的型別安全已由 AgentToolDef.execute 的簽章把關。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aiTools: Record<string, any> = {}
    const gatedToolIds = new Set<string>()
    for (const [id, def] of Object.entries(roleTools)) {
      const needsApproval = !SELF_SUSPENDING_TOOL_IDS.has(id) && (approvalRequirements.get(id) ?? false)
      if (needsApproval) gatedToolIds.add(id)

      aiTools[id] = tool({
        description: def.description,
        inputSchema: jsonSchema(def.inputSchema),
        execute: async (input: unknown) => {
          if (needsApproval) {
            const { approvalId } = await ctx.requestApproval({
              actionType: id,
              summary: `Agent 想執行「${def.description}」，需要您核准後才會真正執行。`,
              details: input as Record<string, unknown>,
              riskLevel: 'high',
            })
            gatedCallsThisTick.push({ toolId: id, input, approvalId })
            await ctx.logStep({ phase: 'approval_requested', toolId: id, toolInput: input, toolOutput: { approvalId } })
            return { status: 'awaiting_human_approval', approvalId }
          }
          let output: unknown
          try {
            output = await def.execute(input as Record<string, unknown>, ctx)
          } catch (e) {
            output = { error: e instanceof Error ? e.message : String(e) }
          }
          await ctx.logStep({ phase: 'tool_call', toolId: id, toolInput: input, toolOutput: output })
          return output
        },
      })
    }

    const suspendingIds = new Set([...SELF_SUSPENDING_TOOL_IDS, ...gatedToolIds])
    const priorLog = log.length ? log.join('\n\n') : '（尚未開始）'

    const systemPrompt =
      `你是公司聘用的「${role.label}」AI Agent，職責：${role.description}\n\n` +
      '規則：\n' +
      '1. 需要花錢、簽約、對外發送訊息（email/簡訊/通訊軟體/電話）等有實際影響的動作前，必須先呼叫 request_human_approval 取得真人核准，不可自行執行。\n' +
      '2. 部分工具本身即受系統管制，呼叫後會自動轉為向真人請求核准，不會立即執行；請視回覆結果決定下一步。\n' +
      '3. 一般查詢、分析、撰寫草稿等低風險動作可自主執行，不需事先核准。\n' +
      '4. 規劃前建議先用 get_company_context / read_role_memory 了解公司狀況與過去經驗。\n' +
      '5. 完成任務、或已無法再推進時，務必呼叫 finish_run 並附上總結報告。\n' +
      '6. 回覆使用繁體中文。'

    const prompt =
      `任務目標：${run.goal}\n\n` +
      `任務輸入：${JSON.stringify(run.input ?? {})}\n\n` +
      `目前為止的執行紀錄：\n${priorLog}\n\n` +
      '請規劃並執行下一步（可視需要呼叫工具），或在任務完成時呼叫 finish_run。'

    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY 未設定')
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const result = await generateText({
      model: anthropic(TICK_MODEL_ID),
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      tools: aiTools,
      stopWhen: ({ steps }) =>
        steps.length >= MAX_STEPS_PER_TICK ||
        steps.some(s => s.toolCalls?.some(tc => suspendingIds.has(tc.toolName))),
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
    const calledExplicitApproval = allToolNames.includes('request_human_approval')
    const calledFinish = allToolNames.includes('finish_run')
    const finalLog = [...log, newLogEntry]

    if (calledFinish) {
      await admin.from('agent_runs').update({ state: { log: finalLog } }).eq('id', run.id)
      await unlock(admin, run.id, { status: 'completed', completed_at: new Date().toISOString() })
      return
    }

    if (calledExplicitApproval || gatedCallsThisTick.length) {
      await unlock(admin, run.id, {
        status: 'waiting_approval',
        state: { log: finalLog, pendingToolCalls: gatedCallsThisTick },
      })
      return
    }

    // 未結束也未暫停：立即排下一輪（同一分鐘內由 cron 或後續呼叫接手）
    await unlock(admin, run.id, {
      status: 'running',
      state: { log: finalLog, pendingToolCalls: [] },
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
