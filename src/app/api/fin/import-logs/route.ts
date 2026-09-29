import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const book = req.nextUrl.searchParams.get('book') || 'FT'

  const { data, error } = await supabase
    .from('fin_import_logs')
    .select('*')
    .eq('owner_id', user.id)
    .eq('account_book', book)
    .order('imported_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data ?? [] })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const action = sp.get('action') || 'revert_batch' // 'revert_batch' | 'revert_all'
  const logId = sp.get('id')

  if (action === 'revert_all') {
    // 一鍵清空該使用者由 MDB 匯入之所有交易（source = 'zero_import'）
    const { data: delRows, error: delErr } = await supabase
      .from('hr_cashflow')
      .delete()
      .eq('owner_id', user.id)
      .eq('source', 'zero_import')
      .select('id')

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    await supabase
      .from('fin_import_logs')
      .update({ status: 'reverted', reverted_at: new Date().toISOString() })
      .eq('owner_id', user.id)
      .eq('status', 'active')

    // 一併移除 MDB 匯入建立之帳戶（仍被手動帳目引用者保留）
    const { data: zeroAccounts } = await supabase
      .from('hr_accounts')
      .select('id')
      .eq('owner_id', user.id)
      .eq('note', '匯入自 Zero')
    const zeroIds = (zeroAccounts ?? []).map((a: { id: string }) => a.id)
    let deletedAccounts = 0
    if (zeroIds.length > 0) {
      const removable: string[] = []
      for (const id of zeroIds) {
        const { count, error: refErr } = await supabase
          .from('hr_cashflow')
          .select('id', { count: 'exact', head: true })
          .or(`account_id.eq.${id},to_account_id.eq.${id}`)
        if (refErr) return NextResponse.json({ error: refErr.message }, { status: 500 })
        if (!count) removable.push(id)
      }
      if (removable.length > 0) {
        const { data: delAcc, error: accErr } = await supabase
          .from('hr_accounts')
          .delete()
          .eq('owner_id', user.id)
          .in('id', removable)
          .select('id')
        if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 })
        deletedAccounts = delAcc?.length ?? 0
      }
    }

    // 一併移除 MDB 匯入建立之科目主檔
    const { data: delSubj, error: subjErr } = await supabase
      .from('fin_subjects')
      .delete()
      .eq('owner_id', user.id)
      .eq('source', 'zero_import')
      .select('id')
    if (subjErr) return NextResponse.json({ error: subjErr.message }, { status: 500 })
    const deletedSubjects = delSubj?.length ?? 0

    return NextResponse.json({
      ok: true,
      action: 'revert_all',
      deleted_count: delRows?.length ?? 0,
      deleted_accounts: deletedAccounts,
      deleted_subjects: deletedSubjects,
      message: `已成功清空所有 MDB 匯入資料（交易 ${delRows?.length ?? 0} 筆、帳戶 ${deletedAccounts} 個、科目 ${deletedSubjects} 個），手動建立之帳目已完整保留。`,
    })
  }

  // 撤回特定批次
  if (!logId) {
    return NextResponse.json({ error: '缺少 log_id 參數' }, { status: 400 })
  }

  // 1. 依 import_batch_id 精準刪除
  const { data: delByBatch, error: errByBatch } = await supabase
    .from('hr_cashflow')
    .delete()
    .eq('owner_id', user.id)
    .eq('import_batch_id', logId)
    .select('id')

  let deletedCount = delByBatch?.length ?? 0

  if (errByBatch) {
    console.warn('依 import_batch_id 刪除失敗，嘗試備用條件:', errByBatch.message)
  }

  // 2. 若為舊版資料庫未打上 import_batch_id 者，讀取 log 進行日期區間與帳本補救撤回
  if (deletedCount === 0) {
    const { data: logInfo } = await supabase
      .from('fin_import_logs')
      .select('*')
      .eq('id', logId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (logInfo && logInfo.status === 'active') {
      // 容錯備用：若該批次為唯一或最新，可依 source='zero_import' 與 log 中的日期區間清除
      const rangeParts = (logInfo.date_range || '').split('~').map((s: string) => s.trim())
      if (rangeParts.length === 2 && rangeParts[0] && rangeParts[1]) {
        const { data: delByRange } = await supabase
          .from('hr_cashflow')
          .delete()
          .eq('owner_id', user.id)
          .eq('source', 'zero_import')
          .gte('date', rangeParts[0])
          .lte('date', rangeParts[1])
          .select('id')
        deletedCount = delByRange?.length ?? 0
      }
    }
  }

  // 3. 更新日誌狀態為已撤回 (reverted)
  await supabase
    .from('fin_import_logs')
    .update({ status: 'reverted', reverted_at: new Date().toISOString() })
    .eq('id', logId)
    .eq('owner_id', user.id)

  return NextResponse.json({
    ok: true,
    action: 'revert_batch',
    log_id: logId,
    deleted_count: deletedCount,
    message: `已成功撤回此批次（共清除 ${deletedCount} 筆流水單據），手動建立之帳目已完整保留。`,
  })
}

