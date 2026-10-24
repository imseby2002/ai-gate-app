/**
 * Guard for user-supplied outbound webhook URLs.
 *
 * Customers configure their own notification webhooks, and the server fetches
 * those URLs. Without a guard an attacker (or a careless config) could point
 * them at internal addresses — e.g. cloud metadata at 169.254.169.254 — turning
 * the fetch into an SSRF. This blocks loopback / private / link-local literals
 * and bare internal hostnames while still allowing normal public endpoints.
 *
 * Note: this checks the URL/host literal only. It does not resolve DNS, so it
 * does not defend against DNS-rebinding; it is a proportionate first line of
 * defence for an owner-configured automation field.
 */
export function isSafeWebhookUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

  const host = url.hostname.toLowerCase()

  // Loopback / unspecified
  if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0' || host === '::1' || host === '[::1]') {
    return false
  }

  // IPv4 literal in a private / reserved range
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const a = Number(v4[1])
    const b = Number(v4[2])
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 169 && b === 254) return false        // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 100 && b >= 64 && b <= 127) return false // CGNAT
    if (a >= 224) return false                       // multicast / reserved
    return true
  }

  // IPv6 literal private / link-local
  if (host.startsWith('[')) {
    const v6 = host.slice(1, -1)
    if (v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80') || v6.startsWith('::ffff:')) {
      return false
    }
    return true
  }

  // Bare hostname with no dot → likely an internal service name
  if (!host.includes('.')) return false

  return true
}

// ─── 強化版：DNS 解析後驗證 + 逐跳重導驗證的安全 fetch ───────────────────────────
import { lookup as dnsLookup } from 'node:dns/promises'
import net from 'node:net'

export class SsrfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SsrfError'
  }
}

/** 判斷解析出的 IP 是否為私有／保留範圍（含 IPv4-mapped IPv6）。 */
export function isPrivateIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const a = Number(v4[1]); const b = Number(v4[2])
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true          // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a >= 224) return true                          // multicast / reserved
    return false
  }
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (v6 === '::1' || v6 === '::') return true
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true   // ULA
  if (v6.startsWith('fe80')) return true                        // link-local
  if (v6.startsWith('::ffff:')) {                               // IPv4-mapped
    const mapped = v6.split(':').pop() || ''
    if (mapped.includes('.')) return isPrivateIp(mapped)
  }
  return false
}

/**
 * 驗證 URL 可安全對外請求：通過字面檢查，並解析 DNS 後確認所有 IP 皆為公開位址。
 * 失敗時丟出 SsrfError。
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  if (!isSafeWebhookUrl(raw)) throw new SsrfError('URL 未通過安全檢查')
  const url = new URL(raw)
  const bareHost = url.hostname.replace(/^\[|\]$/g, '')
  // IP 字面值已於 isSafeWebhookUrl 驗證過
  if (net.isIP(bareHost)) return url
  let records: { address: string }[]
  try {
    records = await dnsLookup(url.hostname, { all: true })
  } catch {
    throw new SsrfError('DNS 無法解析')
  }
  if (!records.length) throw new SsrfError('DNS 無法解析')
  for (const r of records) {
    if (isPrivateIp(r.address)) throw new SsrfError('解析到內部位址，已阻擋')
  }
  return url
}

/**
 * 安全的對外 fetch：每次請求（含每一跳重導）都先通過 assertPublicUrl。
 * 以 redirect:'manual' 手動處理重導，防止重導至內部位址的繞過。
 */
export async function safeFetch(
  raw: string,
  init?: RequestInit,
  opts?: { maxRedirects?: number },
): Promise<Response> {
  const maxRedirects = opts?.maxRedirects ?? 3
  let current = raw
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrl(current)
    const res = await fetch(current, { ...init, redirect: 'manual' })
    const loc = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).toString()
      continue
    }
    return res
  }
  throw new SsrfError('重導次數過多')
}
