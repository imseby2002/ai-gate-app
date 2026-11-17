import { NextRequest, NextResponse } from 'next/server'
import { portalEmployee } from '../_auth'
import { doPunch, punchStatus } from '@/lib/hr/punch-actions'

type Ctx = { params: Promise<{ no: string }> }

// 員工專區：今天（含跨夜未下班）的打卡紀錄、近 7 天彙整、可打卡門市是否已設定定位
export async function GET(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await punchStatus(ctx.admin, ctx.company.ownerId, ctx.emp))
}

// 打卡。body: { lat, lng, accuracy }
export async function POST(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await doPunch(ctx.admin, ctx.company.ownerId, ctx.emp, await req.json().catch(() => ({})))
  return NextResponse.json(r.body, { status: r.status })
}
