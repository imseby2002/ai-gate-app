import { NextRequest, NextResponse } from 'next/server'
import { getCompanyContext } from '@/lib/auth/unit-access'
import { FtError, fetchAppStores } from '@/lib/ft-kiosk/server'

export const maxDuration = 60

// 門市名稱建議代碼：去掉門牌數字與越文聲調，取各字首（Giang Võ → GV），若與人事資料已用的門市代碼相符即採用
function suggestCode(name: string, used: Set<string>): string {
  const plain = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D')
  const words = plain.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !/^\d+$/.test(w))
  const initials = words.map(w => w[0].toUpperCase()).join('')
  if (!initials) return ''
  for (const c of used) {
    const cp = c.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D').toUpperCase()
    if (cp === initials) return c
  }
  return initials
}

// 列出會員 APP 後台的門市，標示是否已建立、建議門市代碼
export async function GET() {
  const ctx = await getCompanyContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let stores
  try {
    stores = await fetchAppStores()
  } catch (err) {
    return NextResponse.json({ error: err instanceof FtError ? err.code : 'FT_UNREACHABLE' }, { status: 502 })
  }
  if (!stores) return NextResponse.json({ error: '未設定會員 APP 後端（FT_API_BASE_URL）' }, { status: 400 })

  const [{ data: existing }, { data: emps }] = await Promise.all([
    ctx.admin.from('fin_stores').select('id, code, name, app_store_no').eq('owner_id', ctx.ownerId),
    ctx.admin.from('hr_employees').select('store').eq('owner_id', ctx.ownerId).eq('status', 'active'),
  ])
  const hrCodes = new Set((emps ?? []).map(e => String(e.store ?? '').trim()).filter(Boolean))
  const byNo = new Map((existing ?? []).filter(e => e.app_store_no).map(e => [e.app_store_no as string, e]))

  return NextResponse.json({
    stores: stores.map(s => {
      const linked = byNo.get(s.store_no) ?? null
      return { ...s, linked: linked ? { id: linked.id, code: linked.code } : null, suggested_code: linked?.code ?? suggestCode(s.name, hrCodes) }
    }),
    hr_codes: [...hrCodes].sort(),
  })
}

// 建立或更新門市。body: { rows: [{ app_store_no, app_store_id, code, name, address, phone }] }
export async function POST(req: NextRequest) {
  const ctx = await getCompanyContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const rows = Array.isArray(body.rows) ? body.rows : []
  const { data: existing } = await ctx.admin.from('fin_stores').select('id, code, app_store_no').eq('owner_id', ctx.ownerId)
  const byNo = new Map((existing ?? []).filter(e => e.app_store_no).map(e => [e.app_store_no as string, e.id as string]))
  const byCode = new Map((existing ?? []).map(e => [String(e.code).toUpperCase(), e.id as string]))

  let created = 0, updated = 0
  const errors: string[] = []
  for (const r of rows) {
    const code = String(r.code ?? '').trim()
    const appNo = String(r.app_store_no ?? '').trim()
    if (!code || !appNo) { errors.push(`${r.name ?? appNo}: 門市代碼必填`); continue }
    const fields = {
      code, name: String(r.name ?? '').trim(), address: String(r.address ?? '').trim(), phone: String(r.phone ?? '').trim(),
      app_store_no: appNo, app_store_id: String(r.app_store_id ?? '').trim(),
    }
    const id = byNo.get(appNo) ?? byCode.get(code.toUpperCase())
    if (id) {
      const { error } = await ctx.admin.from('fin_stores').update(fields).eq('id', id).eq('owner_id', ctx.ownerId)
      if (error) errors.push(`${code}: ${error.message}`); else updated++
    } else {
      const { error } = await ctx.admin.from('fin_stores').insert({ owner_id: ctx.ownerId, ...fields, region: '', active: true, unit_type: 'store' })
      if (error) errors.push(`${code}: ${error.code === '23505' ? '門市編碼重複' : error.message}`); else created++
    }
  }
  return NextResponse.json({ created, updated, errors })
}
