import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildIvtXlsx, latestStocktakeId, type IvtKind } from '@/lib/inv/ivt'

// 供獨立自動化 worker 取得「某門市最新盤點」的 IVT 匯入檔。
// 以共用密鑰 WORKER_SECRET 驗證、以 WORKER_OWNER_ID 決定資料歸屬（單一公司部署）。
// GET /api/worker/ivt-xlsx?secret=...&store=YL&kind=ivt-count|ivt-order[&id=<stocktake>]
const s = (v: unknown) => String(v ?? '').trim()

function secretOk(provided: string, expected: string): boolean {
  const a = Buffer.from(provided), b = Buffer.from(expected)
  if (a.length !== b.length) return false
  try { return timingSafeEqual(a, b) } catch { return false }
}

export async function GET(req: NextRequest) {
  const secret = process.env.WORKER_SECRET
  const ownerId = process.env.WORKER_OWNER_ID
  if (!secret || !ownerId) return NextResponse.json({ error: 'worker endpoint 未啟用（缺 WORKER_SECRET / WORKER_OWNER_ID）' }, { status: 503 })

  const sp = new URL(req.url).searchParams
  if (!secretOk(s(sp.get('secret')), secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const store = s(sp.get('store'))
  const kind = s(sp.get('kind'))
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  if (kind !== 'ivt-count' && kind !== 'ivt-order') return NextResponse.json({ error: 'kind 需為 ivt-count | ivt-order' }, { status: 400 })

  const admin = createAdminClient()
  const id = s(sp.get('id')) || await latestStocktakeId(admin, ownerId, store)
  if (!id) return NextResponse.json({ error: '此門市尚無盤點紀錄' }, { status: 404 })

  const out = await buildIvtXlsx(admin, ownerId, id, kind as IvtKind)
  if (!out) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return new NextResponse(new Uint8Array(out.buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(out.filename)}"`,
    },
  })
}
