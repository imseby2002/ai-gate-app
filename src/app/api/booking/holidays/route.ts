import { createClient } from '@/lib/supabase/server'
import { fetchHolidayCalendar, holidayBlocks } from '@/lib/booking/holidays'

// 批次設定的「快速選假期」：改用政府「中華民國政府行政機關辦公日曆表」（見 lib/booking/holidays.ts），
// 不再由 AI 產生。官方資料只有放假日，沒有學校寒暑假，因此只回傳國定假日／連假區段。
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const country = searchParams.get('country') || 'TW'

  const days = (await Promise.all([year, year + 1].map(y => fetchHolidayCalendar(country, y)))).flat()
  const holidays = holidayBlocks(days).map(b => {
    const main = b.names.find(n => n !== '補假') ?? b.names[0]
    // names 已是簡稱（台灣光復、教師節…）
    const len = Math.round((Date.parse(b.end) - Date.parse(b.start)) / 86400000) + 1
    return { name: len >= 3 ? `${main}連假` : main, from: b.start, to: b.end, type: 'holiday' as const }
  })
  return Response.json({ holidays, year, source: 'data.gov.tw/dataset/14718' })
}
