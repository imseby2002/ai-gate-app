import { NextRequest, NextResponse } from 'next/server'
import { ApplicationProcedureAgent } from '@/lib/legal/procedure-agent'
import { createClient } from '@/lib/supabase/server'
import { getModuleEntitlements, planRequiredResponse } from '@/lib/module-plans/entitlements'
import { minPlanLabel } from '@/lib/module-plans/definitions'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ent = await getModuleEntitlements(user.id, 'legal')
  if (!ent.features.procedures) {
    return planRequiredResponse(`行政程序需法律合規 ${minPlanLabel('legal', f => f.procedures)}方案`, ent.plan)
  }

  try {
    const body = await req.json()
    const { industry = 'beverage', entity_type = '100_FOE', province = 'Hồ Chí Minh', include_import = true } = body

    const agent = new ApplicationProcedureAgent()
    const plan = agent.generateBusinessEstablishmentPlan({
      industry,
      entity_type,
      province,
      include_import,
    })

    return NextResponse.json({
      success: true,
      data: plan,
    })
  } catch (error) {
    console.error('[API /api/legal/procedures] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error while planning procedures' },
      { status: 500 }
    )
  }
}
