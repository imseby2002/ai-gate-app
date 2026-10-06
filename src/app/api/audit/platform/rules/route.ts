import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'
import type { AuditRuleStatus } from '@/lib/types/audit-platform'

// 稽核平台規則庫：依公司（ownerId）存於 audit_rules_v2，每次建立／升級都寫一筆 audit_rule_versions 軌跡
const STATUSES: AuditRuleStatus[] = ['hypothesis', 'suggested', 'approved', 'hard_rule']
const s = (v: unknown) => String(v ?? '').trim()

async function access() {
  const ctx = await getUnitContextAny(['audit', 'store', 'rd'])
  if (ctx.ok) return { ctx, deny: null }
  return { ctx, deny: NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status }) }
}

export async function GET(req: NextRequest) {
  const { ctx, deny } = await access()
  if (deny) return deny
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const category = searchParams.get('category')

  let q = ctx.admin.from('audit_rules_v2').select('*').eq('owner_id', ctx.ownerId)
  if (status && status !== 'all') q = q.eq('status', status)
  if (category && category !== 'all') q = q.eq('category', category)
  const { data: rules, error } = await q.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: versions, error: vErr } = await ctx.admin.from('audit_rule_versions')
    .select('*').eq('owner_id', ctx.ownerId).order('created_at', { ascending: false })
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })

  return NextResponse.json({ success: true, count: rules?.length ?? 0, rules: rules ?? [], versions: versions ?? [] })
}

// body：
//   升級：{ rule_code, promote_to, change_note? }
//   新增：{ title, target_product?, condition_desc?, category?, adjustment_type?, numerical_delta?, unit?, hypothesis_reason?, store? }
export async function POST(req: NextRequest) {
  const { ctx, deny } = await access()
  if (deny) return deny
  const body = await req.json().catch(() => ({}))
  const { data: profile } = await ctx.admin.from('profiles').select('full_name, email').eq('id', ctx.userId).maybeSingle()
  const actor = s(profile?.full_name) || s(profile?.email) || '稽核人員'
  const today = new Date().toISOString().slice(0, 10)

  // ── 升級既有規則 ──
  const promoteTo = s(body.promote_to) as AuditRuleStatus
  if (promoteTo) {
    if (!STATUSES.includes(promoteTo)) return NextResponse.json({ error: '無效的規則狀態' }, { status: 400 })
    const { data: rule, error } = await ctx.admin.from('audit_rules_v2').select('*')
      .eq('owner_id', ctx.ownerId).eq('rule_code', s(body.rule_code)).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!rule) return NextResponse.json({ error: '找不到該規則' }, { status: 404 })

    const nextVersion = `V${(parseInt(String(rule.version).replace(/\D/g, '')) || 1) + 1}`
    const approvedBy = promoteTo === 'approved' || promoteTo === 'hard_rule' ? actor : rule.approved_by
    const { data: updated, error: uErr } = await ctx.admin.from('audit_rules_v2').update({
      status: promoteTo, version: nextVersion, approved_by: approvedBy, updated_at: new Date().toISOString(),
    }).eq('id', rule.id).eq('owner_id', ctx.ownerId).select('*').single()
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

    const { error: vErr } = await ctx.admin.from('audit_rule_versions').insert({
      owner_id: ctx.ownerId, rule_id: rule.id, rule_code: rule.rule_code, version: nextVersion, status: promoteTo,
      adjustment_value: rule.adjustment_value, numerical_delta: rule.numerical_delta,
      effective_from: today, approved_by: actor, change_note: s(body.change_note) || `升級為 ${promoteTo}`,
    })
    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })
    return NextResponse.json({ success: true, rule: updated, message: `規則 ${rule.rule_code} 已設定為【${promoteTo.toUpperCase()}】` })
  }

  // ── 新增規則（假說起步） ──
  const title = s(body.title)
  if (!title) return NextResponse.json({ error: '請輸入規則標題' }, { status: 400 })
  const delta = Number(body.numerical_delta) || 0
  const unit = s(body.unit) || 'ml'

  const { count, error: cErr } = await ctx.admin.from('audit_rules_v2')
    .select('id', { count: 'exact', head: true }).eq('owner_id', ctx.ownerId)
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  const ruleCode = `RULE-${String((count ?? 0) + 1).padStart(4, '0')}`

  const { data: rule, error } = await ctx.admin.from('audit_rules_v2').insert({
    owner_id: ctx.ownerId,
    rule_code: ruleCode,
    title,
    status: 'hypothesis',
    category: s(body.category) || 'material',
    target_product: s(body.target_product) || '全品項',
    condition_desc: s(body.condition_desc),
    adjustment_type: s(body.adjustment_type) || 'tea_adjustment',
    adjustment_value: `${delta > 0 ? '+' : ''}${delta}${unit}`,
    numerical_delta: delta,
    unit,
    hypothesis_reason: s(body.hypothesis_reason),
    store: s(body.store) || null,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? '規則編號重複，請再試一次' : error.message }, { status: 500 })

  const { error: vErr } = await ctx.admin.from('audit_rule_versions').insert({
    owner_id: ctx.ownerId, rule_id: rule.id, rule_code: ruleCode, version: 'V1', status: 'hypothesis',
    adjustment_value: rule.adjustment_value, numerical_delta: delta, effective_from: today,
    approved_by: actor, change_note: '建立規則',
  })
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })
  return NextResponse.json({ success: true, rule, message: `規則 ${ruleCode} 已建立（假說）` })
}
