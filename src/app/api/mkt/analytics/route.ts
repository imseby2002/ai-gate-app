import { getUnitContext } from '@/lib/auth/unit-access'
import { buildMktSnapshot } from '@/lib/mkt/analytics'
import { NextResponse } from 'next/server'

export const maxDuration = 30

export async function GET() {
  const c = await getUnitContext('mkt')
  if (!c.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const snap = await buildMktSnapshot(c.admin, c.ownerId)
  return NextResponse.json(snap)
}
