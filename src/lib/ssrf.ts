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
