import { getUnitContext } from '@/lib/auth/unit-access'
import { buildGmSnapshot } from '@/lib/gm/snapshot'
import { NextResponse } from 'next/server'

export const maxDuration = 30

export async function GET() {
  const c = await getUnitContext('gm')
  if (!c.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const snap = await buildGmSnapshot(c.admin, c.ownerId)
  return NextResponse.json(snap)
}
