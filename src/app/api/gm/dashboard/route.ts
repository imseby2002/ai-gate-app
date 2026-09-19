import { getUnitContext } from '@/lib/auth/unit-access'
import { buildGmSnapshot } from '@/lib/gm/snapshot'
import { NextResponse } from 'next/server'

export const maxDuration = 30

export async function GET() {
  const c = await getUnitContext('gm')
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })
  const snap = await buildGmSnapshot(c.admin, c.ownerId)
  return NextResponse.json(snap)
}
