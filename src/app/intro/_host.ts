import { headers } from 'next/headers'
import { SUBDOMAIN_SYSTEM, type SystemKey } from '@/lib/systems'

// 目前請求所在的系統子網域（cs.im-tourist.com → 'cs'）；www、主網域、localhost 等回 null
export async function introSystem(): Promise<SystemKey | null> {
  const host = (await headers()).get('host') ?? ''
  return SUBDOMAIN_SYSTEM[host.split('.')[0]] ?? null
}
