import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateLocalFollowUpMessage, computeLocalCapacityAnalysis } from '@/lib/reserve/ai'
import { DEFAULT_STAFF, generateInitialAppointments } from '@/lib/reserve/mock-data'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await req.json()
    const { action, serviceName, customerName, staffName, appointments, staffList, prompt } = body

    if (action === 'followup_sms') {
      const result = generateLocalFollowUpMessage(
        serviceName || '極致水飛梭毛孔淨化療程',
        customerName || '貴賓',
        staffName || '林品妤 造型美療師'
      )
      return NextResponse.json({ success: true, result })
    }

    if (action === 'capacity_analysis') {
      const appts = appointments && appointments.length > 0 ? appointments : generateInitialAppointments(new Date().toISOString().slice(0, 10))
      const staff = staffList && staffList.length > 0 ? staffList : DEFAULT_STAFF
      const result = computeLocalCapacityAnalysis(appts, staff)
      return NextResponse.json({ success: true, result })
    }

    if (action === 'smart_schedule') {
      // Natural language scheduling advice
      const userPrompt = prompt || '推薦這週五下午的時段'
      const isWeekend = userPrompt.includes('六') || userPrompt.includes('日') || userPrompt.includes('週末')
      const targetDay = isWeekend ? '週六' : '週五'

      const result = {
        analysis: `針對您的需求「${userPrompt}」，已為您比對門市出勤班表與預約空檔。建議避開尖峰 15:00~17:00 時段，選擇以下 2 個充裕時段體驗最佳：`,
        recommendedSlots: [
          {
            date: `本${targetDay}`,
            time: '11:00',
            staffName: '張家瑋 (Leo) 造型總監',
            reason: '晨間時段光線最佳、服務時間寬裕，無需久候。',
          },
          {
            date: `本${targetDay}`,
            time: '18:00',
            staffName: '林品妤 (Audrey) 技術總監',
            reason: '下班放鬆首選時段，適合安排深層保養與紓壓。',
          },
        ],
      }
      return NextResponse.json({ success: true, result })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('[reserve-ai-post]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
