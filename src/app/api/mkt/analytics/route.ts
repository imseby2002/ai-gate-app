import { getUnitContext } from '@/lib/auth/unit-access'
import { buildMktSnapshot } from '@/lib/mkt/analytics'
import { NextResponse } from 'next/server'

export const maxDuration = 30

export async function GET() {
  const c = await getUnitContext('mkt')
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })
  const snap = await buildMktSnapshot(c.admin, c.ownerId)
  return NextResponse.json(snap)
}
