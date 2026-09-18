import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { createClient } from '@/lib/supabase/server'
import { parseZeroMdb, type ZeroTransaction, type ZeroSubject } from '@/lib/fin/zero-import'

export const maxDuration = 60

const BUCKET = 'fin-zero-import'
const CHUNK = 1000

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: ctx.status }
}

type Admin = Awaited<ReturnType<typeof getAdminUser>>['supabase']

// 依交易中出現的帳戶名稱，補齊 hr_accounts（已存在則沿用、不覆蓋）
// 新建帳戶的期初餘額，帶入 Zero 科目主檔（ITEM_DATA.BEFORE_MOUNT）中同名科目的金額——
// 否則期初為 0，畫面上的「結餘」就只剩交易淨額，會跟 Zero 原始餘額對不起來。
async function ensureAccounts(
  admin: Admin,
  ownerId: string,
  names: string[],
  openingBalanceByName: Map<string, number>,
): Promise<{ map: Map<string, string>; created: number }> {
  const { data: existing } = await admin.from('hr_accounts').select('id, name').eq('owner_id', ownerId)
  const map = new Map<string, string>()
  for (const a of existing ?? []) map.set(a.name, a.id)
  const missing = names.filter(n => n && !map.has(n))
  if (missing.length > 0) {
    const { data: created, error } = await admin.from('hr_accounts')
      .insert(missing.map(name => ({
        owner_id: ownerId, name, kind: 'other',
        opening_balance: openingBalanceByName.get(name) ?? 0,
        note: '匯入自 Zero',
      })))
      .select('id, name')
    if (error) throw new Error(error.message)
    for (const a of created ?? []) map.set(a.name, a.id)
  }
  return { map, created: missing.length }
}

// 自動建置或更新科目主檔（fin_subjects）
async function ensureSubjects(admin: Admin, ownerId: string, bookName: string, subjects: ZeroSubject[]): Promise<number> {
  if (subjects.length === 0) return 0
  const rows = subjects.map(s => ({
    owner_id: ownerId,
    account_book: s.account_book || bookName || 'FT',
    class: s.class,
    parent_name: s.parent_name || '',
    name: s.name,
    initial_balance: s.initial_balance || 0,
    sort_order: s.sort_order || 0,
    style: s.style || '常態性',
    zero_view: s.zero_view !== false,
    is_account: s.is_account || false,
    updated_at: new Date().toISOString(),
  }))

  let countTotal = 0
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    const { count, error } = await admin.from('fin_subjects')
      .upsert(chunk, { onConflict: 'owner_id,account_book,class,parent_name,name', count: 'exact' })
    if (error) {
      console.warn('[ensureSubjects] upsert warning:', error.message)
    } else {
      countTotal += count ?? chunk.length
    }
  }
  return countTotal
}

export async function POST(req: NextRequest) {
  const { user, supabase, status } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

  // 上傳路徑是以「實際登入者」的 auth uid 為資料夾
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
    bookName: parsed.bookName,
    total: parsed.transactions.length,
    skipped: parsed.skipped,
    dateRange: parsed.dateRange,
    dateWarnings: parsed.dateWarnings,
    totalIncome: parsed.totalIncome,
    totalExpense: parsed.totalExpense,
    accountNames: parsed.accountNames,
    bookCount: parsed.bookCount,
    subjectsCount: parsed.subjects.length,
    errors: parsed.errors,
    errorCount: parsed.errorCount,
    warningCount: parsed.warningCount,
  }

  if (mode === 'preview') return NextResponse.json({ preview: summary })

  // commit：自動建置科目 → 補帳戶 → 依 external_ref 去重 → 分批寫入 → 記錄詳細日誌
  try {
    const subjectsCreated = await ensureSubjects(supabase, user.id, parsed.bookName, parsed.subjects)
    const openingBalanceByName = new Map<string, number>()
    for (const s of parsed.subjects) {
      if (s.is_account) openingBalanceByName.set(s.name, s.initial_balance)
    }
    const { map: accountMap, created: accountsCreated } = await ensureAccounts(supabase, user.id, parsed.accountNames, openingBalanceByName)

    // 分頁抓取全部既有 external_ref（PostgREST 預設每次查詢有筆數上限，資料量大時需分頁）
    const existingSet = new Set<string>()
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase.from('hr_cashflow')
        .select('external_ref').eq('owner_id', user.id).neq('external_ref', '')
        .range(from, from + 999)
      for (const r of page ?? []) existingSet.add(r.external_ref)
      if (!page || page.length < 1000) break
    }
    const newTransactions = parsed.transactions.filter(tx => !existingSet.has(tx.external_ref))

    let imported = 0
    for (let i = 0; i < newTransactions.length; i += CHUNK) {
      const chunk = newTransactions.slice(i, i + CHUNK)
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
      const { error, count } = await supabase.from('hr_cashflow').insert(rows)
      if (error) return NextResponse.json({ error: `匯入中斷（已匯入 ${imported} 筆）：${error.message}` }, { status: 500 })
      imported += count ?? rows.length
    }

    // 儲存詳細匯入紀錄與錯誤日誌，供使用者後續檢視與校正
    const fileName = path.split('/').pop() || 'MymoneyData.mdb'
    await supabase.from('fin_import_logs').insert({
      owner_id: user.id,
      account_book: parsed.bookName || 'FT',
      filename: fileName,
      total_rows: parsed.transactions.length + parsed.skipped,
      success_count: imported,
      error_count: parsed.errorCount,
      warning_count: parsed.warningCount,
      subjects_created: subjectsCreated,
      date_range: parsed.dateRange ? `${parsed.dateRange[0]} ~ ${parsed.dateRange[1]}` : '',
      errors: parsed.errors,
    })

    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})

    return NextResponse.json({
      ok: true,
      imported,
      skipped: parsed.skipped,
      alreadyImported: existingSet.size > 0 ? parsed.transactions.length - newTransactions.length : 0,
      accountsCreated,
      subjectsCreated,
      totalParsed: parsed.transactions.length,
      bookName: parsed.bookName,
      errors: parsed.errors,
      errorCount: parsed.errorCount,
      warningCount: parsed.warningCount,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
