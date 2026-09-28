// GA4 Data API（唯讀）：用 Google Cloud 服務帳戶金鑰取得 access token，呼叫 runReport 讀取流量數字。
// 憑證存在行銷自動化「平台設定」的 social_platform_credentials（platform='GA4'）：
//   property_id           — GA4 資源 ID（管理 → 資源設定）
//   service_account_json  — 服務帳戶 JSON 金鑰全文；該服務帳戶的 email 需在 GA4 資源加為「檢視者」
// 不引入 googleapis 套件，JWT 用 Node crypto 簽章。
// https://developers.google.com/identity/protocols/oauth2/service-account#httprest
// https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
import { createSign } from 'crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

export interface Ga4Creds { propertyId: string; clientEmail: string; privateKey: string }

export function ga4CredsFrom(creds: Record<string, string> | null | undefined): Ga4Creds | null {
  const propertyId = String(creds?.property_id ?? '').replace(/^properties\//, '').trim()
  const raw = String(creds?.service_account_json ?? '').trim()
  if (!propertyId || !raw) return null
  try {
    const sa = JSON.parse(raw) as { client_email?: string; private_key?: string }
    if (!sa.client_email || !sa.private_key) return null
    return { propertyId, clientEmail: sa.client_email, privateKey: sa.private_key }
  } catch {
    return null
  }
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url')

async function getAccessToken(creds: Ga4Creds): Promise<string> {
  const iat = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({ iss: creds.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const jwt = `${header}.${claims}.${b64url(signer.sign(creds.privateKey))}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const data = await res.json() as { access_token?: string; error?: string; error_description?: string }
  if (!data.access_token) throw new Error(`GA4 服務帳戶授權失敗：${data.error_description ?? data.error ?? res.status}`)
  return data.access_token
}

const METRICS = ['sessions', 'totalUsers', 'newUsers', 'screenPageViews'] as const
type Metric = typeof METRICS[number]

export interface Ga4Report {
  propertyId: string
  startDate: string
  endDate: string
  totals: Record<Metric, number>
  daily: ({ date: string } & Record<Metric, number>)[]
}

/** startDate / endDate 接受 YYYY-MM-DD、today、yesterday、NdaysAgo（GA4 原生格式） */
export async function getGa4Report(creds: Ga4Creds, startDate = '28daysAgo', endDate = 'today'): Promise<Ga4Report> {
  const token = await getAccessToken(creds)
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${creds.propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: METRICS.map(name => ({ name })),
      metricAggregations: ['TOTAL'],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 400,
    }),
  })
  const data = await res.json() as {
    rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[]
    totals?: { metricValues: { value: string }[] }[]
    error?: { message?: string }
  }
  if (!res.ok) throw new Error(`GA4 讀取失敗：${data.error?.message ?? res.status}`)

  const toMetrics = (vals: { value: string }[] | undefined) =>
    Object.fromEntries(METRICS.map((m, i) => [m, Number(vals?.[i]?.value ?? 0) || 0])) as Record<Metric, number>

  return {
    propertyId: creds.propertyId,
    startDate,
    endDate,
    totals: toMetrics(data.totals?.[0]?.metricValues),
    daily: (data.rows ?? []).map(r => {
      const d = r.dimensionValues[0]?.value ?? ''
      return { date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, ...toMetrics(r.metricValues) }
    }),
  }
}
