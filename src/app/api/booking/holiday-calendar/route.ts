import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchHolidayCalendar, holidayBlocks, type CalendarDay } from '@/lib/booking/holidays'

// GET ?country=TW&years=2026,2027 → 官方辦公日曆（逐日）與連續假日區段
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const country = sp.get('country') || 'TW'
  const years = (sp.get('years') || String(new Date().getFullYear()))
    .split(',').map(Number).filter(y => y >= 2000 && y <= 2100).slice(0, 3)

  const days: CalendarDay[] = (await Promise.all(years.map(y => fetchHolidayCalendar(country, y)))).flat()
  const missingYears = years.filter(y => !days.some(d => d.date.startsWith(String(y))))
  return NextResponse.json({ country, days, blocks: holidayBlocks(days), missingYears })
}
