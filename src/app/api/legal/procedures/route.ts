import { NextRequest, NextResponse } from 'next/server'
import { ApplicationProcedureAgent } from '@/lib/legal/procedure-agent'

export async function POST(req: NextRequest) {
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
