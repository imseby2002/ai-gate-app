// Agent 目標任務（Mission）：真人只給「目標＋預算＋期限」，
// Agent 先盤點 marketing.im-tourist.com 既有資源、產出計畫書（plan_ready），
// 真人按「執行」後建立綁定 mission 的 agent_run，由 engine.ts 依計畫全程執行。
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveCompanyOwner } from '@/lib/company/activeCompany'
import { calculateCost } from '@/lib/ai/router'
import { deductCredits } from '@/lib/skills/billing'

type Admin = ReturnType<typeof createAdminClient>

export const MISSION_PLANNER_MODEL = 'claude-sonnet-4-6'
// 長期任務（1–3 個月）需要比一般 run 多的 tick 額度；搭配 schedule_next_check 分散在整段期間
export const MISSION_MAX_TICKS = 400

export interface MissionKpi {
  key: string
  name: string
  target: number
  unit: string
  due?: string | null
  measurement?: string
  current?: number | null
  updated_at?: string | null
  source?: string | null
}

export interface MissionRow {
  id: string
  user_id: string
  owner_id: string
  role_id: string
  objective: string
  budget_amount: number
  budget_currency: string
  deadline: string | null
  status: string
  plan: Record<string, unknown>
  kpis: MissionKpi[]
  progress_log: { at: string; note: string; kpi_updates?: Record<string, number> }[]
  plan_feedback: string | null
  budget_spent: number
  run_id: string | null
}

/** 行銷資料歸屬帳號：所屬公司 owner；個人帳號＝自己 */
export async function resolveMissionOwner(admin: Admin, userId: string): Promise<string> {
  const { data: profile } = await admin.from('profiles').select('company_id').eq('id', userId).maybeSingle()
  const owner = await resolveCompanyOwner(admin, (profile?.company_id as string | null) ?? null)
  return owner ?? userId
}

export async function loadMission(admin: Admin, missionId: string): Promise<MissionRow | null> {
  const { data } = await admin.from('agent_missions').select('*').eq('id', missionId).maybeSingle()
  return (data as MissionRow | null) ?? null
}

/** 盤點 marketing.im-tourist.com 既有資源（給計畫書與 list_marketing_resources 工具共用） */
export async function buildMarketingInventory(admin: Admin, ownerId: string): Promise<Record<string, unknown>> {
  const today = new Date().toISOString().slice(0, 10)
  const [brand, contentTotal, contentApproved, calendar, offline, delivery, companyData] = await Promise.all([
    admin.from('mkt_brand').select('name, slogan, tagline, tone, audience, selling_points').eq('owner_id', ownerId).maybeSingle(),
    admin.from('mkt_content').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    admin.from('mkt_content').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('status', 'approved'),
    admin.from('mkt_calendar').select('title, channel, scheduled_date, status').eq('owner_id', ownerId).gte('scheduled_date', today).order('scheduled_date').limit(30),
    admin.from('mkt_offline').select('type, budget, status').eq('owner_id', ownerId).limit(20),
    admin.from('mkt_delivery').select('platform, status, monthly_orders, monthly_revenue').eq('owner_id', ownerId).limit(30),
    admin.from('company_data').select('compiled_md').eq('user_id', ownerId).maybeSingle(),
  ])

  return {
    brand: brand.data ?? null,
    content: { total: contentTotal.count ?? 0, approved: contentApproved.count ?? 0 },
    upcoming_calendar: calendar.data ?? [],
    offline_marketing: offline.data ?? [],
    delivery_channels: delivery.data ?? [],
    company_knowledge_chars: (companyData.data?.compiled_md as string | undefined)?.length ?? 0,
    // marketing.im-tourist.com 可由 Agent 直接操作的內部能力（對應 agent 工具）
    internal_capabilities: [
      '市場/競品/社群資料蒐集（collect_market_data）',
      '市場與競品分析（analyze_market）',
      '多平台整套內容產出：FB/IG/TikTok/Zalo/LINE 文案＋短影音腳本＋生圖提示＋GEO 文章（create_content_set）',
      '內容行事曆排程（schedule_content）',
      '行銷成效快照：外送營收、行銷支出、內容產出（get_marketing_snapshot）',
      '配圖/短影音腳本規劃（plan_image_content / plan_video_content）',
    ],
    // 目前沒有自動化串接、需真人操作或外部資源的項目
    not_automated: [
      '實際發佈到 FB/IG/Threads/LINE VOOM/Zalo/TikTok 等官方帳號：行銷中心「行銷自動化」可用已連結帳號一鍵上傳，但 Agent 不自行發佈，排程後由真人在行銷自動化按上傳',
      '付費廣告投放（Meta/Google/TikTok Ads 帳戶未串接，需走外部採購申請＋真人操作）',
      'KOL/媒體/外包廠商付款',
    ],
  }
}

function extractJson(text: string): Record<string, unknown> {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  return JSON.parse(t)
}

/** 產出（或依回饋重新產出）計畫書，寫回 mission 並設為 plan_ready */
export async function generateMissionPlan(missionId: string): Promise<MissionRow> {
  const admin = createAdminClient()
  const mission = await loadMission(admin, missionId)
  if (!mission) throw new Error('找不到任務')
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY 未設定')

  await admin.from('agent_missions').update({ status: 'planning', last_error: null }).eq('id', missionId)

  try {
    const [{ data: role }, inventory, { data: companyData }, { data: memory }] = await Promise.all([
      admin.from('agent_roles').select('label, description').eq('id', mission.role_id).maybeSingle(),
      buildMarketingInventory(admin, mission.owner_id),
      admin.from('company_data').select('compiled_md').eq('user_id', mission.owner_id).maybeSingle(),
      admin.from('agent_memory_compiled').select('compiled_md').eq('user_id', mission.user_id).eq('role_id', mission.role_id).maybeSingle(),
    ])

    const today = new Date().toISOString().slice(0, 10)
    const system =
      `你是公司聘用的「${role?.label ?? mission.role_id}」，職責：${role?.description ?? ''}\n` +
      '你要根據老闆給的目標與預算，產出一份「可直接照表執行」的計畫書。規則：\n' +
      '1. 優先使用公司內部既有資源（marketing.im-tourist.com 的能力清單），內部做不到的才列為外部資源，並附預估金額。\n' +
      '2. 所有外部花費總和（含預備金）不可超過預算；預算為 0 時只能用內部資源與免費管道。\n' +
      '3. 觸及人數、轉換率等數字都是估計，必須寫出估算依據與假設；目標不切實際時要明說，並提出可達成的修正目標，不可虛報。\n' +
      '4. 只能用合法、符合平台規範的做法：不可使用假帳號、洗讚、買粉、垃圾訊息、冒用他人身分。\n' +
      '5. 需要真人身分驗證或 Agent 無法自動化的步驟（開帳號、實際發文、廣告帳戶操作、付款）標記 executor 為 human。\n' +
      '6. KPI 要可量測，說明資料來源（例如：粉專後台觸及、GA 使用者數、外送平台訂單、POS 營收）。\n' +
      '7. 只輸出 JSON，不要 markdown 圍欄或其他文字。'

    const shape = `{
  "title": "計畫名稱",
  "summary": "三到五句的計畫摘要",
  "feasibility": { "verdict": "realistic|stretch|unrealistic", "reason": "判斷依據", "adjusted_target": "若不切實際，提出可達成的修正目標；否則空字串" },
  "assumptions": ["估算假設..."],
  "situation": { "internal_resources_used": ["..."], "gaps": ["內部沒有、需要外部或真人補足的項目"] },
  "kpis": [ { "key": "awareness_30d", "name": "30 天品牌觸及人數", "target": 10000, "unit": "人", "due": "YYYY-MM-DD", "measurement": "量測方式與資料來源" } ],
  "strategy": [ { "channel": "管道", "why": "為什麼選它", "approach": "具體做法" } ],
  "phases": [
    { "name": "階段名稱", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "goal": "階段目標",
      "tasks": [ { "id": "T1", "title": "任務", "channel": "管道", "resource": "internal|external|human",
                   "tool": "對應的內部工具（internal 時填）", "vendor_type": "外部資源類型（external 時填）",
                   "est_cost": 0, "executor": "agent|human", "kpi_keys": ["awareness_30d"] } ] }
  ],
  "budget": { "currency": "${mission.budget_currency}", "total": ${Number(mission.budget_amount) || 0},
              "lines": [ { "item": "項目", "type": "internal|external", "amount": 0, "why": "理由" } ], "reserve": 0 },
  "human_actions": ["需要老闆/員工親自完成的事項"],
  "risks": [ { "risk": "風險", "mitigation": "因應" } ],
  "check_cadence_days": 3
}`

    const user =
      `今天日期：${today}\n` +
      `目標：${mission.objective}\n` +
      `預算：${mission.budget_amount} ${mission.budget_currency}\n` +
      `期限：${mission.deadline ?? '（未指定，請依目標自行建議）'}\n` +
      (mission.plan_feedback ? `\n老闆對上一版計畫的修改意見（務必採納）：${mission.plan_feedback}\n` : '') +
      `\n公司知識庫：\n${(companyData?.compiled_md as string | undefined)?.slice(0, 6000) || '（尚未建立）'}\n` +
      `\n過去經驗（角色記憶）：\n${(memory?.compiled_md as string | undefined)?.slice(0, 3000) || '（無）'}\n` +
      `\nmarketing.im-tourist.com 資源盤點：\n${JSON.stringify(inventory).slice(0, 8000)}\n` +
      `\n請依下列 JSON 結構輸出計畫書：\n${shape}`

    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await generateText({
      model: anthropic(MISSION_PLANNER_MODEL),
      system,
      maxOutputTokens: 8000,
      messages: [{ role: 'user', content: user }],
    })

    const usage = (res.usage ?? {}) as unknown as Record<string, number | undefined>
    const cost = calculateCost(MISSION_PLANNER_MODEL, usage.inputTokens ?? 0, usage.outputTokens ?? 0)
    if (cost > 0) await deductCredits(mission.user_id, cost, `agent-mission-plan:${mission.id}`)

    const plan = extractJson(res.text)
    const kpis: MissionKpi[] = Array.isArray(plan.kpis)
      ? (plan.kpis as Record<string, unknown>[]).map((k, i) => ({
          key: String(k.key ?? `kpi_${i + 1}`),
          name: String(k.name ?? ''),
          target: Number(k.target) || 0,
          unit: String(k.unit ?? ''),
          due: k.due ? String(k.due) : null,
          measurement: String(k.measurement ?? ''),
          current: null,
          updated_at: null,
          source: null,
        }))
      : []

    const { data, error } = await admin
      .from('agent_missions')
      .update({ plan, kpis, status: 'plan_ready', last_error: null })
      .eq('id', missionId)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as MissionRow
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await admin.from('agent_missions').update({ status: 'failed', last_error: `計畫書產出失敗：${message}` }).eq('id', missionId)
    throw e
  }
}

/** 真人按「執行」：建立綁定 mission 的 run，交給 cron 的 engine 續跑 */
export async function startMissionExecution(mission: MissionRow): Promise<string> {
  const admin = createAdminClient()
  const { data: userRole } = await admin
    .from('user_agent_roles')
    .select('id, enabled')
    .eq('user_id', mission.user_id)
    .eq('role_id', mission.role_id)
    .maybeSingle()
  if (!userRole?.enabled) throw new Error('請先在「角色設定」啟用此角色')

  const { data: run, error } = await admin
    .from('agent_runs')
    .insert({
      user_id: mission.user_id,
      role_id: mission.role_id,
      user_role_id: userRole.id,
      mission_id: mission.id,
      status: 'queued',
      trigger_type: 'manual',
      goal: `依已核准的計畫書執行目標任務：${mission.objective}`,
      input: { missionId: mission.id, maxTicks: MISSION_MAX_TICKS },
      next_tick_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !run) throw new Error(error?.message ?? '建立執行失敗')

  await admin
    .from('agent_missions')
    .update({ status: 'executing', run_id: run.id, started_at: new Date().toISOString(), last_error: null })
    .eq('id', mission.id)
  return run.id as string
}

/** 給 engine 的 system prompt 附加段落：已核准計畫書、預算狀態、KPI 現況 */
export function buildMissionPrompt(mission: MissionRow): string {
  const remaining = Number(mission.budget_amount) - Number(mission.budget_spent)
  const recent = (mission.progress_log ?? []).slice(-5).map(p => `- ${p.at.slice(0, 10)}：${p.note}`).join('\n')
  return (
    '\n\n【目標任務模式】你正在執行一份老闆已按下「執行」核准的計畫書：\n' +
    `目標：${mission.objective}\n` +
    `今天日期：${new Date().toISOString().slice(0, 10)}；期限：${mission.deadline ?? '依計畫書'}\n` +
    `預算：${mission.budget_amount} ${mission.budget_currency}；已核准動用：${mission.budget_spent}；剩餘：${remaining}\n` +
    `KPI 現況：${JSON.stringify(mission.kpis)}\n` +
    (recent ? `最近進度：\n${recent}\n` : '') +
    `計畫書：${JSON.stringify(mission.plan).slice(0, 12000)}\n\n` +
    '執行規則：\n' +
    'A. 計畫書內 executor=agent 且使用內部資源的任務已視為核准，直接用對應工具執行，不需再請示。\n' +
    'B. 需要花錢的外部資源一律呼叫 request_external_purchase（附廠商、金額、網址、理由），不可超過剩餘預算；核准後依結果繼續（付款、下單等實際操作若無 API，改用 request_human_approval 以 human_action_required 列出步驟請真人完成）。\n' +
    'C. executor=human 的任務，用 request_human_approval（actionType=human_action_required）把步驟寫清楚交給真人。\n' +
    'D. 每完成一批任務或取得新數據，呼叫 report_mission_progress 更新 KPI 實際值與進度；數字只能來自工具結果或真人回報，不可自行編造。\n' +
    'E. 當前階段該做的都做完、要等時間經過（例如內容曝光累積、下一階段開始）時，呼叫 schedule_next_check 指定下次檢查時間，不要空轉。\n' +
    'F. 期限到了或所有 KPI 都有結論時，呼叫 finish_run 附成果報告（達成/未達成、花費、學到的經驗），並先用 write_memory 記下經驗。\n'
  )
}

/**
 * 依核准結果同步外部採購申請狀態，並重算已動用預算（approved + paid）。
 * 冪等：每個 mission tick 開頭都呼叫一次，不依賴核准回覆從哪個管道進來。
 */
export async function syncMissionExpenses(admin: Admin, missionId: string): Promise<void> {
  const { data: proposed } = await admin
    .from('agent_mission_expenses')
    .select('id, approval_id')
    .eq('mission_id', missionId)
    .eq('status', 'proposed')
    .not('approval_id', 'is', null)

  if (proposed?.length) {
    const { data: approvals } = await admin
      .from('agent_approvals')
      .select('id, status')
      .in('id', proposed.map(p => p.approval_id as string))
    const statusById = new Map((approvals ?? []).map(a => [a.id as string, a.status as string]))
    for (const e of proposed) {
      const st = statusById.get(e.approval_id as string)
      const next = st === 'approved' ? 'approved' : st === 'rejected' || st === 'expired' || st === 'cancelled' ? 'rejected' : null
      if (next) await admin.from('agent_mission_expenses').update({ status: next, updated_at: new Date().toISOString() }).eq('id', e.id)
    }
  }

  const { data: spent } = await admin
    .from('agent_mission_expenses')
    .select('amount')
    .eq('mission_id', missionId)
    .in('status', ['approved', 'paid'])
  const total = (spent ?? []).reduce((t, e) => t + Number(e.amount), 0)
  await admin.from('agent_missions').update({ budget_spent: total }).eq('id', missionId)
}
