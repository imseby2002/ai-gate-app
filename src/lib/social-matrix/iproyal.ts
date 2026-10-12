// IPRoyal 住宅代理 API（https://resi-api.iproyal.com/v1，Bearer 金鑰）：
// 使用者購買住宅代理時建立子帳號並配發 GB，加購時再 give-traffic；配發的流量從主帳號扣。
import { randomBytes } from 'crypto'

const BASE = 'https://resi-api.iproyal.com/v1'

async function call<T>(token: string, path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`IPRoyal ${res.status}: ${text.slice(0, 300)}`)
  return (text ? JSON.parse(text) : {}) as T
}

function randomId(len: number) {
  return randomBytes(len).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, len).padEnd(len, '0')
}

export async function createResiSubuser(token: string, trafficGb: number) {
  const username = `ag${randomId(10).toLowerCase()}`
  const password = randomId(16)
  const data = await call<{ hash?: string; data?: { hash?: string } }>(token, '/residential-subusers', {
    username,
    password,
    traffic: trafficGb,
  })
  const hash = data.hash ?? data.data?.hash
  if (!hash) throw new Error('IPRoyal 未回傳子帳號 hash')
  return { hash, username, password }
}

export async function giveResiTraffic(token: string, hash: string, amountGb: number) {
  await call(token, `/residential-subusers/${encodeURIComponent(hash)}/give-traffic`, { amount: amountGb })
}

export function resiApiToken(off: { api_token?: string | null }) {
  return off.api_token || process.env.IPROYAL_RESI_API_TOKEN || null
}
