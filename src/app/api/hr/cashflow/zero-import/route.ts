import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { createClient } from '@/lib/supabase/server'
import { parseZeroMdb, type ZeroTransaction } from '@/lib/fin/zero-import'

const BUCKET = 'fin-zero-import'
const CHUNK = 1000

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

type Admin = Awaited<ReturnType<typeof getAdminUser>>['supabase']

// 依交易中出現的帳戶名稱，補齊 hr_accounts（已存在則沿用、不覆蓋）
async function ensureAccounts(admin: Admin, ownerId: string, names: string[]): Promise<{ map: Map<string, string>; created: number }> {
  const { data: existing } = await admin.from('hr_accounts').select('id, name').eq('owner_id', ownerId)
  const map = new Map<string, string>()
  for (const a of existing ?? []) map.set(a.name, a.id)
  const missing = names.filter(n => n && !map.has(n))
  if (missing.length > 0) {
    const { data: created, error } = await admin.from('hr_accounts')
      .insert(missing.map(name => ({ owner_id: ownerId, name, kind: 'other', opening_balance: 0, note: '匯入自 Zero' })))
      .select('id, name')
    if (error) throw new Error(error.message)
    for (const a of created ?? []) map.set(a.name, a.id)
  }
  return { map, created: missing.length }
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 上傳路徑是以「實際登入者」的 auth uid 為資料夾（storage RLS 也是如此判斷），
  // 與 user.id（單位資料歸屬的 ownerId，公司 IT 時會是負責人 id）不同，需分開驗證。
  const authSupabase = await createClient()
  const { data: { user: authUser } } = await authSupabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const path = String(body.path ?? '')
  const mode = body.mode === 'commit' ? 'commit' : 'preview'
  if (!path || !path.startsWith(`${authUser.id}/`)) return NextResponse.json({ error: 'path required' }, { status: 400 })

  const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(path)
  if (dlErr || !file) return NextResponse.json({ error: '找不到上傳的檔案，請重新上傳' }, { status: 404 })

  let parsed
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    parsed = parseZeroMdb(buffer)
  } catch (e) {
    return NextResponse.json({ error: `無法解析此檔案，請確認是 Zero 匯出的 .mdb 資料庫：${e instanceof Error ? e.message : String(e)}` }, { status: 400 })
  }

  const summary = {
    total: parsed.transactions.length,
    skipped: parsed.skipped,
    dateRange: parsed.dateRange,
    dateWarnings: parsed.dateWarnings,
    totalIncome: parsed.totalIncome,
    totalExpense: parsed.totalExpense,
    accountNames: parsed.accountNames,
    bookCount: parsed.bookCount,
  }

  if (mode === 'preview') return NextResponse.json({ preview: summary })

  // commit：補帳戶 → 分批 upsert（以 external_ref 去重，可重複執行不會重覆匯入）
  try {
    const { map: accountMap, created: accountsCreated } = await ensureAccounts(supabase, user.id, parsed.accountNames)
    let imported = 0
    for (let i = 0; i < parsed.transactions.length; i += CHUNK) {
      const chunk = parsed.transactions.slice(i, i + CHUNK)
      const rows = chunk.map((tx: ZeroTransaction) => ({
        owner_id: user.id,
        type: tx.type,
        category: tx.category,
        category_parent: tx.category_parent,
        amount: tx.amount,
        date: tx.date,
        description: tx.description,
        notes: tx.notes,
        pay_coll_name: tx.pay_coll_name,
        invoice_no: tx.invoice_no,
        account_id: accountMap.get(tx.account_name) ?? null,
        to_account_id: tx.type === 'transfer' ? (accountMap.get(tx.to_account_name ?? '') ?? null) : null,
        receipt_url: '',
        external_ref: tx.external_ref,
        source: 'zero_import',
      }))
      const { error, count } = await supabase.from('hr_cashflow')
        .upsert(rows, { onConflict: 'owner_id,external_ref', ignoreDuplicates: true, count: 'exact' })
      if (error) return NextResponse.json({ error: `匯入中斷（已匯入 ${imported} 筆）：${error.message}` }, { status: 500 })
      imported += count ?? 0
    }

    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})

    return NextResponse.json({
      ok: true, imported, skipped: parsed.skipped,
      accountsCreated,
      totalParsed: parsed.transactions.length,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
