// Agent 執行環境：src/lib/skills/runtime.ts 的超集。
// 重用既有的模型呼叫/生圖/生音/存檔，額外提供 agent 專屬能力
// （公司知識庫、角色記憶、跨管道通知/核准、內部 API 呼叫、逐步稽核紀錄、計費）。
import { createSkillContext } from '@/lib/skills/runtime'
import { createAdminClient } from '@/lib/supabase/admin'
import { deductCredits as deductSkillCredits } from '@/lib/skills/billing'
import { notifyHuman as notifyHumanChannel, requestHumanApproval } from './notify'
import type { AgentRunContext, AgentRunStepInput } from './types'

export function createAgentContext(userId: string, roleId: string, runId: string): AgentRunContext {
  const skillCtx = createSkillContext(userId)
  const admin = createAdminClient()

  return {
    userId,
    roleId,
    runId,
    callModel: skillCtx.callModel,
    generateImage: skillCtx.generateImage,
    generateAudio: skillCtx.generateAudio,
    storeFile: skillCtx.storeFile,

    async getCompanyContext() {
      const { data } = await admin
        .from('company_data')
        .select('compiled_md')
        .eq('user_id', userId)
        .maybeSingle()
      return data?.compiled_md ?? ''
    },

    async getRoleMemory(limit = 20) {
      const { data: compiled } = await admin
        .from('agent_memory_compiled')
        .select('compiled_md')
        .eq('user_id', userId)
        .eq('role_id', roleId)
        .maybeSingle()
      if (compiled?.compiled_md) return compiled.compiled_md

      // 尚無彙整快取：直接取最近的原始筆記，依重要性/時間排序
      const { data: notes } = await admin
        .from('agent_memory')
        .select('memory_type, content, importance, created_at')
        .eq('user_id', userId)
        .eq('role_id', roleId)
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)
      if (!notes?.length) return ''
      return notes.map(n => `- [${n.memory_type}] ${n.content}`).join('\n')
    },

    async writeMemory(entry) {
      await admin.from('agent_memory').insert({
        user_id: userId,
        role_id: roleId,
        memory_type: entry.type,
        content: entry.content,
        tags: entry.tags ?? [],
        importance: entry.importance ?? 3,
        source_run_id: runId,
      })
    },

    async notifyHuman(params) {
      return notifyHumanChannel({ userId, ...params })
    },

    async requestApproval(params) {
      const { approvalId } = await requestHumanApproval({ userId, runId, roleId, ...params })
      return { approvalId }
    },

    async callInternalApi(path, body) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const cronSecret = process.env.CRON_SECRET ?? ''
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Cron-Secret': cronSecret },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? `內部 API ${path} 失敗（${res.status}）`)
      return data
    },

    async logStep(entry: AgentRunStepInput) {
      const { count } = await admin
        .from('agent_run_steps')
        .select('id', { count: 'exact', head: true })
        .eq('run_id', runId)
      await admin.from('agent_run_steps').insert({
        run_id: runId,
        step_index: count ?? 0,
        phase: entry.phase,
        tool_id: entry.toolId ?? null,
        tool_input: entry.toolInput ?? null,
        tool_output: entry.toolOutput ?? null,
        thought: entry.thought ?? null,
        model_id: entry.modelId ?? null,
        input_tokens: entry.inputTokens ?? null,
        output_tokens: entry.outputTokens ?? null,
        credits_spent: entry.creditsSpent ?? 0,
      })
    },

    async deductCredits(amount, description) {
      if (amount <= 0) return
      const result = await deductSkillCredits(userId, amount, description)
      if (!result.ok) throw new Error(result.reason === 'insufficient' ? 'INSUFFICIENT_CREDITS' : '扣款失敗')
      // run 在單一 tick 內序列執行（engine 以 locked_at 保護），直接讀寫累加即可，不需額外鎖
      const { data: run } = await admin.from('agent_runs').select('total_credits_spent').eq('id', runId).single()
      const current = Number(run?.total_credits_spent ?? 0)
      await admin.from('agent_runs').update({ total_credits_spent: current + amount }).eq('id', runId)
    },
  }
}
