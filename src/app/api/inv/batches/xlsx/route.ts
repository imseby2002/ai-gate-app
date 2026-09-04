import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { buildXlsx, type XlsxCell } from '@/lib/hr/xlsx'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const s = (v: unknown) => String(v ?? '').trim()

// ?store= → 空白進貨批次表（帶入該門市原料清單，進貨日期／到期日／數量留空填寫）
export async function GET(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const store = s(new URL(req.url).searchParams.get('store'))
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })

  const { data } = await supabase.from('inv_movements')
    .select('material_code, material_name, unit, year, month')
    .eq('owner_id', user.id).eq('store', store)
    .order('year', { ascending: false }).order('month', { ascending: false })

  const seen = new Set<string>()
  const rows: XlsxCell[][] = [['原料碼', '名稱', '單位', '進貨日期(YYYY-MM-DD)', '到期日(YYYY-MM-DD)', '數量']]
  for (const m of data ?? []) {
    if (seen.has(m.material_code)) continue
    seen.add(m.material_code)
    rows.push([m.material_code, m.material_name, m.unit, '', '', ''])
  }
  return new NextResponse(new Uint8Array(buildXlsx('進貨批次表', rows)), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(`進貨批次表_${store}.xlsx`)}"`,
    },
  })
}
