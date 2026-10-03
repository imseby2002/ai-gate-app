// 目標任務（Mission）執行工具：操作 marketing.im-tourist.com 內部資源、回報 KPI、外部採購申請、排定下次檢查。
// 行銷資料一律寫入 mission.owner_id（公司 owner）名下，與行銷中心頁面看到的是同一份資料。
import { createAdminClient } from '@/lib/supabase/admin'
import { buildMarketingInventory, loadMission, type MissionRow } from '../missions'
import { generateContentSet } from '@/lib/mkt/generate'
import { buildMktSnapshot } from '@/lib/mkt/analytics'
import { publishToPlatforms, SUPPORTED_PLATFORMS, type CredentialRow } from '@/lib/marketing/publish'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { IMAGE_PROVIDER_COSTS, getCostMultiplier, priceFromCost } from '@/lib/marketing/billing'
import { createAwarenessCampaign, getAdAccount, getInsights, metaAdsCredsFrom, setStatus, type MetaAdsCreds } from '@/lib/marketing/meta-ads'
import { ga4CredsFrom, getGa4Report } from '@/lib/marketing/ga4'
import { getLineFollowers, getSiteMemberCounts, lineTokenFrom, memberJoinKey, memberJoinUrl } from '@/lib/marketing/members'
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

async function missionForRunOrNull(ctx: AgentRunContext): Promise<MissionRow | null> {
  try { return await missionForRun(ctx) } catch { return null }
}

// 行銷自動化「平台設定」的憑證：先找本人，沒有再找公司 owner（與行銷中心同一份資料）
async function loadCredentialRows(ctx: AgentRunContext): Promise<CredentialRow[]> {
  const admin = createAdminClient()
  const ownerId = await ownerForRun(ctx)
  for (const uid of [ctx.userId, ownerId]) {
    const { data } = await admin.from('social_platform_credentials').select('platform, credentials, is_connected').eq('user_id', uid)
    if (data?.some(r => r.is_connected)) return data as CredentialRow[]
  }
  return []
}

async function loadMetaAdsCreds(ctx: AgentRunContext): Promise<MetaAdsCreds> {
  const rows = await loadCredentialRows(ctx)
  const fb = rows.find(r => r.platform === 'Facebook' && r.is_connected)
  const creds = metaAdsCredsFrom(fb?.credentials)
  if (!creds) throw new Error('行銷自動化「平台設定」的 Facebook 尚未填 Page Access Token／Page ID／廣告帳戶 ID，請用 request_human_approval 請真人補上')
  return creds
}

const CONTENT_CHANNELS =['fb', 'ig', 'tiktok', 'zalo', 'line']
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

interface GenerateImageInput { prompt: string; aspect_ratio?: string }

export const generateMarketingImageTool: AgentToolDef = {
  id: 'generate_marketing_image',
  description: '用 AI 生成行銷配圖（英文提示詞效果最好，可直接用 create_content_set 回傳的 image_prompt），回傳圖片網址，供發文或廣告素材使用。',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '英文生圖提示詞' },
      aspect_ratio: { type: 'string', enum: ['1:1', '4:5', '9:16', '16:9'], description: 'FB/IG 貼文建議 1:1' },
    },
    required: ['prompt'],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as GenerateImageInput
    const url = await ctx.generateImage(input.prompt, input.aspect_ratio ?? '1:1')
    if (!url) throw new Error('圖片生成失敗')
    // Nano Banana Pro 成本 × 方案倍率
    await ctx.deductCredits(priceFromCost(IMAGE_PROVIDER_COSTS.flux, await getCostMultiplier(ctx.userId)), `agent-image:${ctx.runId}`)
    return { imageUrl: url }
  },
}

interface PublishInput { platforms: string[]; copy_text: string; image_urls?: string[]; video_url?: string; content_id?: string; calendar_id?: string }

export const publishToSocialTool: AgentToolDef = {
  id: 'publish_to_social',
  description:
    '用行銷自動化同一套上傳功能，發佈到「平台設定」已連結的社群帳號（Facebook、Instagram、Threads、LinkedIn、Twitter/X、LINE VOOM、Zalo、FB/IG Reels、YouTube Shorts、TikTok）。' +
    '任務未開啟「自動發文」時，每篇會先送真人審核，核准後才發出。FB/IG 圖文需要圖片網址；Reels/Shorts/TikTok 需要影片網址。',
  inputSchema: {
    type: 'object',
    properties: {
      platforms: { type: 'array', items: { type: 'string', enum: [...SUPPORTED_PLATFORMS] } },
      copy_text: { type: 'string', description: '貼文文案（含 hashtags）' },
      image_urls: { type: 'array', items: { type: 'string' } },
      video_url: { type: 'string' },
      content_id: { type: 'string', description: '對應內容庫 id（選填，成功後標記為已發佈）' },
      calendar_id: { type: 'string', description: '對應行事曆 id（選填，成功後標記為已發佈）' },
    },
    required: ['platforms', 'copy_text'],
  },
  async requiresApproval(_input, ctx) {
    const mission = await missionForRunOrNull(ctx)
    return !mission?.auto_publish
  },
  approvalSummary(rawInput) {
    const input = rawInput as unknown as PublishInput
    return (
      `📣 發文審核\n平台：${input.platforms.join('、')}\n\n${input.copy_text}\n` +
      (input.image_urls?.length ? `\n圖片：\n${input.image_urls.join('\n')}\n` : '') +
      (input.video_url ? `\n影片：${input.video_url}\n` : '') +
      '\n核准後立即發出。確認沒問題後，可在任務頁開啟「自動發文」免逐篇審核。'
    )
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as PublishInput
    const admin = createAdminClient()
    const { features } = await getMarketingEntitlements(admin, ctx.userId)
    if (!features.uploadPlatforms) return { ok: false, error: '目前行銷方案未開放自動上傳平台（需 PRO 以上）' }

    const credRows = await loadCredentialRows(ctx)
    const connected = credRows.filter(r => r.is_connected).map(r => r.platform)
    if (!connected.length) return { ok: false, error: '行銷自動化「平台設定」尚未連結任何社群帳號' }

    const results = await publishToPlatforms(credRows, input.platforms, input.image_urls ?? [], input.video_url ?? '', input.copy_text)
    if (results.some(r => r.ok)) {
      const ownerId = await ownerForRun(ctx)
      const now = new Date().toISOString()
      if (input.content_id) await admin.from('mkt_content').update({ status: 'published', updated_at: now }).eq('id', input.content_id).eq('owner_id', ownerId)
      if (input.calendar_id) await admin.from('mkt_calendar').update({ status: 'published', updated_at: now }).eq('id', input.calendar_id).eq('owner_id', ownerId)
    }
    return { connectedPlatforms: connected, results }
  },
}

interface AdsInsightsInput { object_id?: string; date_preset?: string; since?: string; until?: string }

export const metaAdsInsightsTool: AgentToolDef = {
  id: 'meta_ads_insights',
  description: '讀取 Meta 廣告成效（觸及人數 reach、曝光、花費、點擊）。不帶 object_id 為整個廣告帳戶；可帶廣告活動 id。觸及類 KPI 以此為數據來源。',
  inputSchema: {
    type: 'object',
    properties: {
      object_id: { type: 'string', description: '廣告活動 id（選填）' },
      date_preset: { type: 'string', enum: ['today', 'yesterday', 'last_7d', 'last_14d', 'last_30d', 'last_90d', 'this_month', 'maximum'] },
      since: { type: 'string', description: 'YYYY-MM-DD（與 until 一起用）' },
      until: { type: 'string', description: 'YYYY-MM-DD' },
    },
    required: [],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as AdsInsightsInput
    const creds = await loadMetaAdsCreds(ctx)
    return getInsights(creds, { objectId: input.object_id, datePreset: input.date_preset, since: input.since, until: input.until })
  },
}

interface AdsLaunchInput {
  name: string; daily_budget: number; days: number; countries?: string[]; age_min?: number; age_max?: number
  message: string; image_url: string; link?: string; reason: string
}

export const metaAdsLaunchTool: AgentToolDef = {
  id: 'meta_ads_launch',
  description:
    '建立並上線 Meta（FB/IG）觸及型廣告：總花費＝每日預算×天數，不可超過任務剩餘預算。' +
    '任務未開啟「自動投放廣告」時會先送真人審核，核准後才建立並上線。',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      daily_budget: { type: 'number', description: '每日預算（任務幣別金額，需與廣告帳戶幣別相同）' },
      days: { type: 'number', description: '投放天數 1–90' },
      countries: { type: 'array', items: { type: 'string' }, description: 'ISO 國碼，如 ["TW"]' },
      age_min: { type: 'number' },
      age_max: { type: 'number' },
      message: { type: 'string', description: '廣告文案' },
      image_url: { type: 'string', description: '廣告圖片網址' },
      link: { type: 'string', description: '點擊後連結（選填，預設粉專）' },
      reason: { type: 'string', description: '為何投放、預期觸及' },
    },
    required: ['name', 'daily_budget', 'days', 'message', 'image_url', 'reason'],
  },
  async requiresApproval(_input, ctx) {
    const mission = await missionForRunOrNull(ctx)
    return !mission?.auto_ads
  },
  approvalSummary(rawInput) {
    const i = rawInput as unknown as AdsLaunchInput
    return (
      `💰 Meta 廣告投放審核\n名稱：${i.name}\n每日預算：${i.daily_budget} × ${i.days} 天 = ${i.daily_budget * i.days}\n` +
      `地區：${(i.countries ?? ['TW']).join('、')}；年齡：${i.age_min ?? 18}–${i.age_max ?? 65}\n理由：${i.reason}\n\n文案：\n${i.message}\n\n圖片：${i.image_url}\n` +
      '\n核准後立即建立並上線。確認沒問題後，可在任務頁開啟「自動投放廣告」（仍受任務預算上限控管）。'
    )
  },
  async execute(rawInput, ctx) {
    const i = rawInput as unknown as AdsLaunchInput
    const admin = createAdminClient()
    const mission = await missionForRun(ctx)
    const days = Math.min(90, Math.max(1, Math.round(Number(i.days) || 0)))
    const daily = Number(i.daily_budget)
    if (!Number.isFinite(daily) || daily <= 0) return { ok: false, error: '每日預算必須大於 0' }
    const total = daily * days

    const { data: pending } = await admin.from('agent_mission_expenses').select('amount').eq('mission_id', mission.id).eq('status', 'proposed')
    const pendingTotal = (pending ?? []).reduce((t, e) => t + Number(e.amount), 0)
    const remaining = Number(mission.budget_amount) - Number(mission.budget_spent) - pendingTotal
    if (total > remaining) return { ok: false, error: `總花費 ${total} 超出剩餘預算 ${remaining} ${mission.budget_currency}` }

    const creds = await loadMetaAdsCreds(ctx)
    const account = await getAdAccount(creds)
    if (account.currency.toUpperCase() !== mission.budget_currency.toUpperCase()) {
      return { ok: false, error: `廣告帳戶幣別 ${account.currency} 與任務預算幣別 ${mission.budget_currency} 不同，請真人調整後再試` }
    }

    const ids = await createAwarenessCampaign(creds, {
      name: i.name, dailyBudget: daily, days, countries: i.countries ?? ['TW'],
      ageMin: i.age_min, ageMax: i.age_max, message: i.message, imageUrl: i.image_url, link: i.link,
    }, account.currency)

    // 先記帳（佔用預算）再上線；上線失敗時廣告維持暫停、不會花錢
    await admin.from('agent_mission_expenses').insert({
      mission_id: mission.id, vendor: 'Meta Ads', description: `${i.name}（${daily}×${days} 天）`,
      amount: total, status: 'approved', note: `campaign ${ids.campaignId}`,
    })
    await admin.from('agent_missions').update({ budget_spent: Number(mission.budget_spent) + total }).eq('id', mission.id)

    try {
      await setStatus(creds, [ids.campaignId, ids.adsetId, ids.adId], 'ACTIVE')
      return { ok: true, status: 'ACTIVE', ...ids }
    } catch (e) {
      return { ok: false, status: 'PAUSED', error: e instanceof Error ? e.message : String(e), ...ids }
    }
  },
}

interface AdsPauseInput { object_id: string; reason: string }

export const metaAdsPauseTool: AgentToolDef = {
  id: 'meta_ads_pause',
  description: '暫停 Meta 廣告活動（成效不佳或已達標時用，停止花費）。',
  inputSchema: {
    type: 'object',
    properties: { object_id: { type: 'string', description: '廣告活動 id' }, reason: { type: 'string' } },
    required: ['object_id', 'reason'],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as AdsPauseInput
    await setStatus(await loadMetaAdsCreds(ctx), [input.object_id], 'PAUSED')
    return { ok: true, status: 'PAUSED' }
  },
}

interface Ga4Input { start_date?: string; end_date?: string }

export const ga4MetricsTool: AgentToolDef = {
  id: 'get_ga4_metrics',
  description:
    '讀取官網 GA4 流量（唯讀）：sessions（造訪次數）、totalUsers（使用者數）、newUsers（新使用者數）、screenPageViews（瀏覽量），含期間合計、每日明細與依網站網域（byHost：外部官網／本平台民宿官網）分開的數字。' +
    '瀏覽率／網站流量類 KPI 以此為數據來源。日期可用 YYYY-MM-DD、today、yesterday、NdaysAgo，預設近 28 天。',
  inputSchema: {
    type: 'object',
    properties: {
      start_date: { type: 'string', description: '起日，例如 2026-09-01 或 28daysAgo' },
      end_date: { type: 'string', description: '迄日，例如 today' },
    },
    required: [],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as Ga4Input
    const rows = await loadCredentialRows(ctx)
    const creds = ga4CredsFrom(rows.find(r => r.platform === 'GA4' && r.is_connected)?.credentials)
    if (!creds) throw new Error('行銷自動化「平台設定」的 GA4 尚未填資源 ID 與服務帳戶金鑰，請用 request_human_approval 請真人補上')
    return getGa4Report(creds, input.start_date || '28daysAgo', input.end_date || 'today')
  },
}

interface MemberCountsInput { since?: string }

export const memberCountsTool: AgentToolDef = {
  id: 'get_member_counts',
  description:
    '讀取「會員數」KPI（唯讀）：① LINE 官方帳號好友數（昨日，LINE 官方統計）② 官網會員總數與 since 之後新增數（依來源 utm_source 分組）。' +
    '同時回傳官網「加入會員」連結 join_url——發文、廣告、LINE 推播導流時請附此連結並加上 ?utm_source=渠道（例如 fb、ig、line）以便追蹤成效。',
  inputSchema: {
    type: 'object',
    properties: { since: { type: 'string', description: '計算新增官網會員的起日 YYYY-MM-DD（選填，通常用任務開始日）' } },
    required: [],
  },
  async execute(rawInput, ctx) {
    const input = rawInput as unknown as MemberCountsInput
    const admin = createAdminClient()
    const ownerId = await ownerForRun(ctx)
    const rows = await loadCredentialRows(ctx)
    const token = lineTokenFrom(rows)

    let line: unknown = { error: '尚未綁定 LINE 官方帳號（客服頻道或平台設定的 LINE VOOM），無法讀取好友數' }
    if (token) {
      try { line = await getLineFollowers(token) } catch (e) { line = { error: e instanceof Error ? e.message : String(e) } }
    }
    const site = await getSiteMemberCounts(admin, ownerId, input.since)
    return { line_friends: line, site_members: site, join_url: memberJoinUrl(await memberJoinKey(admin, ownerId)) }
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
  [generateMarketingImageTool.id]: generateMarketingImageTool,
  [publishToSocialTool.id]: publishToSocialTool,
  [metaAdsInsightsTool.id]: metaAdsInsightsTool,
  [ga4MetricsTool.id]: ga4MetricsTool,
  [memberCountsTool.id]: memberCountsTool,
  // 需綁定目標任務（預算上限），非任務 run 呼叫會回錯誤
  [metaAdsLaunchTool.id]: metaAdsLaunchTool,
  [metaAdsPauseTool.id]: metaAdsPauseTool,
}
