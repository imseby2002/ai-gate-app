// Meta Marketing API（廣告）最小封裝：讀成效、建立觸及型廣告、暫停/啟用。
// 憑證沿用行銷自動化「平台設定」的 Facebook 那一列（social_platform_credentials, platform='Facebook'）：
//   page_access_token（需為具 ads_management 權限的 System User token）、page_id、ad_account_id。
const GRAPH = 'https://graph.facebook.com/v25.0'

// Meta 對這些幣別不使用小數位（預算數字即為該幣別金額），其餘幣別以「分」為單位（×100）
const ZERO_DECIMAL = new Set(['CLP', 'COP', 'CRC', 'HUF', 'IDR', 'ISK', 'JPY', 'KRW', 'PYG', 'TWD', 'VND'])

export interface MetaAdsCreds { token: string; adAccountId: string; pageId: string }

export function metaAdsCredsFrom(creds: Record<string, string> | null | undefined): MetaAdsCreds | null {
  const token = creds?.page_access_token?.trim()
  // 廣告帳戶 ID 容錯：act_123、act=123、123 都只取數字部分
  const accountDigits = creds?.ad_account_id?.replace(/\D/g, '')
  const pageId = creds?.page_id?.trim()
  if (!token || !accountDigits || !pageId) return null
  return { token, adAccountId: `act_${accountDigits}`, pageId }
}

async function graph(path: string, token: string, params: Record<string, unknown> = {}, method: 'GET' | 'POST' = 'GET') {
  const url = new URL(`${GRAPH}/${path}`)
  let body: URLSearchParams | undefined
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v))
    url.searchParams.set('access_token', token)
  } else {
    body = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) body.set(k, typeof v === 'string' ? v : JSON.stringify(v))
    body.set('access_token', token)
  }
  const res = await fetch(url, { method, body })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    const e = data.error ?? {}
    throw new Error(`Meta API ${path}：${e.error_user_msg || e.message || res.status}`)
  }
  return data
}

export async function getAdAccount(c: MetaAdsCreds): Promise<{ name: string; currency: string; account_status: number }> {
  return graph(c.adAccountId, c.token, { fields: 'name,currency,account_status' })
}

export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(ZERO_DECIMAL.has(currency.toUpperCase()) ? amount : amount * 100)
}

export async function getInsights(
  c: MetaAdsCreds,
  opts: { objectId?: string; datePreset?: string; since?: string; until?: string },
) {
  const params: Record<string, unknown> = { fields: 'reach,impressions,frequency,spend,clicks,ctr,cpm' }
  if (opts.since && opts.until) params.time_range = { since: opts.since, until: opts.until }
  else params.date_preset = opts.datePreset ?? 'last_30d'
  const data = await graph(`${opts.objectId || c.adAccountId}/insights`, c.token, params)
  return data.data?.[0] ?? { reach: '0', impressions: '0', spend: '0' }
}

export interface LaunchInput {
  name: string
  dailyBudget: number        // 帳戶幣別金額（非分）
  days: number
  countries: string[]        // ISO 國碼，如 ['TW']
  ageMin?: number
  ageMax?: number
  message: string
  imageUrl: string
  link?: string
}

/** 建立觸及型（OUTCOME_AWARENESS）廣告：campaign → adset → creative → ad，全部先以 PAUSED 建立，由呼叫端再啟用 */
export async function createAwarenessCampaign(c: MetaAdsCreds, input: LaunchInput, currency: string) {
  const start = new Date(Date.now() + 10 * 60_000)
  const end = new Date(start.getTime() + input.days * 86_400_000)

  const campaign = await graph(`${c.adAccountId}/campaigns`, c.token, {
    name: input.name,
    objective: 'OUTCOME_AWARENESS',
    status: 'PAUSED',
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  }, 'POST')

  const adset = await graph(`${c.adAccountId}/adsets`, c.token, {
    name: `${input.name} - 受眾`,
    campaign_id: campaign.id,
    daily_budget: toMinorUnits(input.dailyBudget, currency),
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'REACH',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    targeting: {
      geo_locations: { countries: input.countries.length ? input.countries : ['TW'] },
      age_min: input.ageMin ?? 18,
      age_max: input.ageMax ?? 65,
    },
    status: 'PAUSED',
  }, 'POST')

  const creative = await graph(`${c.adAccountId}/adcreatives`, c.token, {
    name: `${input.name} - 素材`,
    object_story_spec: {
      page_id: c.pageId,
      link_data: {
        message: input.message,
        link: input.link || `https://www.facebook.com/${c.pageId}`,
        picture: input.imageUrl,
      },
    },
  }, 'POST')

  const ad = await graph(`${c.adAccountId}/ads`, c.token, {
    name: input.name,
    adset_id: adset.id,
    creative: { creative_id: creative.id },
    status: 'PAUSED',
  }, 'POST')

  return { campaignId: campaign.id as string, adsetId: adset.id as string, creativeId: creative.id as string, adId: ad.id as string }
}

export async function setStatus(c: MetaAdsCreds, objectIds: string[], status: 'ACTIVE' | 'PAUSED') {
  for (const id of objectIds) await graph(id, c.token, { status }, 'POST')
}
