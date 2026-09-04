// 總經理室跨部門彙整快照：供即時儀表板與每日快報共用。
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePnl } from '@/lib/gm/pnl'

type Admin = ReturnType<typeof createAdminClient>

export type GmFlag = { dept: string; level: 'urgent' | 'warn' | 'info'; text: string }
export interface GmStoreRow { code: string; name: string; revenue: number; gross_profit: number; store_profit: number; profit: number; gross_margin: number; net_margin: number }
export interface GmSnapshot {
  period: string
  finance: { period: string; stores: GmStoreRow[]; total: { revenue: number; gross_profit: number; store_profit: number; profit: number } } | null
  repair: { open: number; overdue: number; warranty_soon: number }
  affairs: { expiring: { title: string; doc_type: string; expiry_date: string; days: number }[]; count: number }
  hr: { active: number; new_this_month: number; contracts_expiring: number }
  audit: { active_rules: number }
  flags: GmFlag[]
}

const INACTIVE_EMP = ['resigned', 'terminated', 'inactive', '離職', '停用']
const daysTo = (d: string) => { const t = new Date(d + 'T00:00:00'); const now = new Date(); now.setHours(0, 0, 0, 0); return Math.round((t.getTime() - now.getTime()) / 86400000) }

export async function buildGmSnapshot(admin: Admin, ownerId: string): Promise<GmSnapshot> {
  const flags: GmFlag[] = []

  // ── 損益（財務／營運）：最新期間 ──
  const { data: periods } = await admin.from('pnl_entries').select('period').eq('owner_id', ownerId).order('period', { ascending: false }).limit(1)
  const period = periods?.[0]?.period ?? ''
  let finance: GmSnapshot['finance'] = null
  if (period) {
    const [{ data: stores }, { data: entries }] = await Promise.all([
      admin.from('pnl_stores').select('id, code, name, kind').eq('owner_id', ownerId).eq('archived', false),
      admin.from('pnl_entries').select('store_id, line_code, amount').eq('owner_id', ownerId).eq('period', period),
    ])
    const byStore: Record<string, Record<string, number>> = {}
    for (const e of entries ?? []) {
      const sid = e.store_id as string
      ;(byStore[sid] ??= {})[e.line_code as string] = Number(e.amount) || 0
    }
    const storeRows: GmStoreRow[] = (stores ?? [])
      .filter(s => s.kind === 'store')
      .map(s => {
        const r = resolvePnl(byStore[s.id] ?? {})
        const revenue = r.revenue || 0
        return {
          code: s.code, name: s.name,
          revenue, gross_profit: r.gross_profit || 0, store_profit: r.store_profit || 0, profit: r.profit || 0,
          gross_margin: revenue ? r.gross_profit / revenue : 0,
          net_margin: revenue ? r.profit / revenue : 0,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
    const total = storeRows.reduce((t, s) => ({
      revenue: t.revenue + s.revenue, gross_profit: t.gross_profit + s.gross_profit,
      store_profit: t.store_profit + s.store_profit, profit: t.profit + s.profit,
    }), { revenue: 0, gross_profit: 0, store_profit: 0, profit: 0 })
    for (const s of storeRows) {
      if (s.profit < 0) flags.push({ dept: '財務', level: 'urgent', text: `${s.name} 本期淨利為負（${Math.round(s.profit).toLocaleString('zh-TW')}）` })
      else if (s.store_profit < 0) flags.push({ dept: '財務', level: 'warn', text: `${s.name} 店面營業利益為負` })
    }
    finance = { period, stores: storeRows, total }
  }

  // ── 維修 ──
  const [{ data: orders }, { data: equip }] = await Promise.all([
    admin.from('repair_orders').select('status, reported_at').eq('owner_id', ownerId),
    admin.from('repair_equipment').select('warranty_until, status').eq('owner_id', ownerId),
  ])
  const openStatus = ['reported', 'assigned', 'in_progress']
  const open = (orders ?? []).filter(o => openStatus.includes(o.status as string))
  const overdue = open.filter(o => o.reported_at && daysTo(String(o.reported_at).slice(0, 10)) <= -7)
  const warrantySoon = (equip ?? []).filter(e => e.status === 'active' && e.warranty_until && daysTo(e.warranty_until as string) <= 30)
  const repair = { open: open.length, overdue: overdue.length, warranty_soon: warrantySoon.length }
  if (overdue.length) flags.push({ dept: '維修', level: 'warn', text: `${overdue.length} 張工單逾 7 天未完成` })
  if (warrantySoon.length) flags.push({ dept: '維修', level: 'info', text: `${warrantySoon.length} 台設備保固將於 30 天內到期` })

  // ── 外務／法遵 ──
  const { data: docs } = await admin.from('affair_documents').select('title, doc_type, expiry_date, status').eq('owner_id', ownerId).not('expiry_date', 'is', null)
  const expiringDocs = (docs ?? [])
    .filter(d => d.status !== 'archived' && d.expiry_date)
    .map(d => ({ title: d.title, doc_type: d.doc_type, expiry_date: d.expiry_date as string, days: daysTo(d.expiry_date as string) }))
    .filter(d => d.days <= 30)
    .sort((a, b) => a.days - b.days)
  const affairs = { expiring: expiringDocs.slice(0, 20), count: expiringDocs.length }
  for (const d of expiringDocs) {
    if (d.days < 0) flags.push({ dept: '外務', level: 'urgent', text: `${d.title || d.doc_type} 已逾期 ${-d.days} 天` })
    else if (d.days <= 14) flags.push({ dept: '外務', level: 'warn', text: `${d.title || d.doc_type} ${d.days} 天後到期` })
  }

  // ── 人事 ──
  const monthStr = (() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })()
  const [{ data: emps }, { data: contracts }] = await Promise.all([
    admin.from('hr_employees').select('status, hire_date').eq('owner_id', ownerId),
    admin.from('hr_contracts').select('end_date').eq('owner_id', ownerId).not('end_date', 'is', null),
  ])
  const activeEmps = (emps ?? []).filter(e => !INACTIVE_EMP.includes(String(e.status ?? '')))
  const newThisMonth = (emps ?? []).filter(e => e.hire_date && String(e.hire_date) >= monthStr).length
  const contractsExpiring = (contracts ?? []).filter(c => c.end_date && daysTo(c.end_date as string) <= 60 && daysTo(c.end_date as string) >= -7).length
  const hr = { active: activeEmps.length, new_this_month: newThisMonth, contracts_expiring: contractsExpiring }
  if (contractsExpiring) flags.push({ dept: '人事', level: 'info', text: `${contractsExpiring} 份合約 60 天內到期` })

  // ── 稽核 ──
  const { count: auditRules } = await admin.from('audit_rules').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('active', true)
  const audit = { active_rules: auditRules ?? 0 }

  const order = { urgent: 0, warn: 1, info: 2 }
  flags.sort((a, b) => order[a.level] - order[b.level])

  return { period, finance, repair, affairs, hr, audit, flags }
}
