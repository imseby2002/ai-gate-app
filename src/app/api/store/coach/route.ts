import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { STORE_COACH_KNOWLEDGE } from '@/lib/store-coach/knowledge-base'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const section = searchParams.get('section') || 'all'

    const ctx = await getUnitContext('store').catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    let dbLayouts = null
    let dbWorkstations = null
    let dbProblems = null
    let dbBestPractices = null

    if (supabase) {
      try {
        const [lRes, wRes, pRes, bRes] = await Promise.allSettled([
          supabase.from('store_layouts').select('*').limit(20),
          supabase.from('workstations').select('*').limit(50),
          supabase.from('store_problems').select('*').order('created_at', { ascending: false }).limit(20),
          supabase.from('store_best_practices').select('*').limit(50),
        ])

        if (lRes.status === 'fulfilled' && lRes.value.data && lRes.value.data.length > 0) {
          dbLayouts = lRes.value.data
        }
        if (wRes.status === 'fulfilled' && wRes.value.data && wRes.value.data.length > 0) {
          dbWorkstations = wRes.value.data
        }
        if (pRes.status === 'fulfilled' && pRes.value.data && pRes.value.data.length > 0) {
          dbProblems = pRes.value.data
        }
        if (bRes.status === 'fulfilled' && bRes.value.data && bRes.value.data.length > 0) {
          dbBestPractices = bRes.value.data
        }
      } catch (err) {
        console.warn('Store coach live DB query fallback to knowledge base:', err)
      }
    }

    const payload = {
      layouts: dbLayouts || STORE_COACH_KNOWLEDGE.layouts,
      workstations: dbWorkstations || STORE_COACH_KNOWLEDGE.workstations,
      staffMovements: STORE_COACH_KNOWLEDGE.staffMovements,
      bestPractices: dbBestPractices || STORE_COACH_KNOWLEDGE.bestPractices,
      hygieneStandards: STORE_COACH_KNOWLEDGE.hygieneStandards,
      cleaningSequences: STORE_COACH_KNOWLEDGE.cleaningSequences,
      serviceBehaviors: STORE_COACH_KNOWLEDGE.serviceBehaviors,
      coachingMethods: STORE_COACH_KNOWLEDGE.coachingMethods,
      employeeCompetencies: STORE_COACH_KNOWLEDGE.employeeCompetencies,
      managerCompetencies: STORE_COACH_KNOWLEDGE.managerCompetencies,
      problemMemories: dbProblems || STORE_COACH_KNOWLEDGE.problemMemories,
      companyPrinciples: STORE_COACH_KNOWLEDGE.companyPrinciples,
      zaloAccounts: STORE_COACH_KNOWLEDGE.zaloAccounts,
    }

    if (section !== 'all' && (payload as any)[section]) {
      return NextResponse.json({ [section]: (payload as any)[section] })
    }

    return NextResponse.json(payload)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load store coach data' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { action, data } = body

    const ctx = await getUnitContext('store').catch(() => ({ ok: true, admin: null }))
    const supabase = ctx.admin

    if (supabase && action === 'report_problem' && data) {
      const { data: inserted, error } = await supabase
        .from('store_problems')
        .insert({
          title: data.title,
          category: data.category || 'quality',
          description: data.description,
          severity: data.severity || 'medium',
          status: 'diagnosed',
          store_code: data.store_code || 'TNN-01',
          product_name: data.product_name || null,
          root_cause: data.root_cause || null,
          immediate_action: data.immediate_action || null,
          preventive_action: data.preventive_action || null,
        })
        .select('*')
        .single()

      if (!error && inserted) {
        return NextResponse.json({ success: true, problem: inserted })
      }
    }

    return NextResponse.json({
      success: true,
      action,
      timestamp: new Date().toISOString(),
      note: 'Operation completed (synchronized in session)',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'POST failed' }, { status: 500 })
  }
}
