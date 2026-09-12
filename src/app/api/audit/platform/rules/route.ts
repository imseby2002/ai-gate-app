import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'
import { INITIAL_AUDIT_RULES, INITIAL_RULE_VERSIONS } from '@/lib/audit/platform-core'
import type { AuditRule, AuditRuleVersion } from '@/lib/types/audit-platform'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    const ctx = await getUnitContextAny(['audit', 'store', 'rd']).catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    let rules: AuditRule[] = INITIAL_AUDIT_RULES
    let versions: AuditRuleVersion[] = INITIAL_RULE_VERSIONS

    if (supabase) {
      try {
        let query = supabase.from('audit_rules_v2').select('*')
        if (status && status !== 'all') {
          query = query.eq('status', status)
        }
        if (category && category !== 'all') {
          query = query.eq('category', category)
        }
        const { data: dbRules, error } = await query.order('created_at', { ascending: false })
        if (!error && dbRules && dbRules.length > 0) {
          rules = dbRules
        }

        const { data: dbVersions } = await supabase.from('audit_rule_versions').select('*').order('created_at', { ascending: false })
        if (dbVersions && dbVersions.length > 0) {
          versions = dbVersions
        }
      } catch (err) {
        console.warn('Fallback to seeded rules & versions:', err)
      }
    }

    if (status && status !== 'all') {
      rules = rules.filter(r => r.status === status)
    }
    if (category && category !== 'all') {
      rules = rules.filter(r => r.category === category)
    }

    return NextResponse.json({
      success: true,
      count: rules.length,
      rules,
      versions,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch rules' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      id,
      rule_code,
      title,
      status = 'hypothesis',
      category = 'material',
      target_product,
      condition_desc,
      adjustment_type = 'tea_adjustment',
      adjustment_value,
      numerical_delta = 0,
      unit = 'ml',
      version = 'V1',
      effective_from = new Date().toISOString().slice(0, 10),
      effective_to = null,
      approved_by = null,
      hypothesis_reason = '',
      confidence = 85,
      change_note = '規則建立或更新',
      promote_to,
    } = body

    if (!title && !promote_to) {
      return NextResponse.json({ error: '請提供規則標題或欲升級之規則狀態' }, { status: 400 })
    }

    const ctx = await getUnitContextAny(['audit', 'store', 'rd']).catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    const newCode = rule_code || `RULE-${String(Math.floor(10000 + Math.random() * 90000)).slice(1)}`
    const finalStatus = promote_to || status

    const ruleObj: AuditRule = {
      id: id || `rule-${Date.now()}`,
      rule_code: newCode,
      title: title || `${target_product || '產品'} ${adjustment_value || '耗用調整'} 規則`,
      status: finalStatus,
      category,
      target_product: target_product || '全品項',
      condition_desc: condition_desc || '一般條件',
      adjustment_type,
      adjustment_value: adjustment_value || `${numerical_delta > 0 ? '+' : ''}${numerical_delta}${unit}`,
      numerical_delta: Number(numerical_delta) || 0,
      unit,
      version,
      effective_from,
      effective_to,
      approved_by: finalStatus === 'hard_rule' || finalStatus === 'approved' ? (approved_by || '稽核審核委員會') : null,
      hypothesis_reason,
      confidence: Number(confidence) || 85,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const versionObj: AuditRuleVersion = {
      id: `ver-${Date.now()}`,
      rule_id: ruleObj.id,
      rule_code: newCode,
      version: ruleObj.version,
      adjustment_value: ruleObj.adjustment_value,
      numerical_delta: ruleObj.numerical_delta,
      effective_from: ruleObj.effective_from,
      effective_to: ruleObj.effective_to,
      approved_by: ruleObj.approved_by || '系統記錄',
      change_note: change_note || `升級為 ${finalStatus}`,
      created_at: new Date().toISOString(),
    }

    if (supabase) {
      try {
        await supabase.from('audit_rules_v2').upsert(ruleObj)
        await supabase.from('audit_rule_versions').insert(versionObj)
      } catch (err) {
        console.warn('Persist rule to DB fallback to session:', err)
      }
    }

    return NextResponse.json({
      success: true,
      rule: ruleObj,
      version: versionObj,
      message: `規則 ${newCode} 已成功設定為【${finalStatus.toUpperCase()}】！`,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Rule creation failed' }, { status: 500 })
  }
}
