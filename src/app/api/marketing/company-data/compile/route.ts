/**
 * POST /api/marketing/company-data/compile
 * 由公司資料主檔（mkt_brand / fin_stores / mkt_product_profiles）編譯成 Markdown，
 * 寫入 company_data.compiled_md 供 AI 使用。
 */
import { NextResponse } from 'next/server'
import { currentDataOwner, compileCompanyMd } from '@/lib/company/profile'

export async function POST() {
  const c = await currentDataOwner()
  if (!c) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const compiled_md = await compileCompanyMd(c.admin, c.ownerId)
  return NextResponse.json({ ok: true, compiled_md, chars: compiled_md.length })
}
