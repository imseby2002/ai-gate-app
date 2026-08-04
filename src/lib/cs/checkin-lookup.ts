import { generateText, type LanguageModel } from 'ai'
import { getBookingEntitlements } from '@/lib/booking/entitlements'

// 入住時間判斷（民宿資料 check_in_time 可設，預設 15:00）。
// 訂單系統與訂單密碼表(資料來源)兩條路徑共用，未到入住時間一律不給密碼。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkBeforeCheckin(supabase: any, userId: string): Promise<{ before: boolean; checkinTime: string; nowHHMM: string }> {
  let checkinTime = ''

  // 1. 客服系統設定優先（source_prefs.checkinTime）——只有客服系統的用戶在此設定
  const { data: pref } = await supabase
    .from('cs_data_sources')
    .select('config')
    .eq('user_id', userId)
    .eq('type', 'source_prefs')
    .maybeSingle()
  checkinTime = ((pref?.config as { checkinTime?: string } | null)?.checkinTime || '').slice(0, 5)

  // 2. fallback 訂單系統/民宿資料的 check_in_time
  if (!checkinTime) {
    const { data: profile } = await supabase
      .from('bnb_profiles')
      .select('check_in_time')
      .eq('user_id', userId)
      .maybeSingle()
    checkinTime = ((profile?.check_in_time as string) || '15:00').slice(0, 5)
  }

  if (!/^\d{2}:\d{2}$/.test(checkinTime)) checkinTime = '15:00'
  const nowHHMM = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' })
  return { before: nowHHMM < checkinTime, checkinTime, nowHHMM }
}

// 依訂單號碼從「訂單系統」(bnb_daily_records → bookings) 查今日入住資訊與門鎖密碼。
// cs-chat 沙盒與 cs-webhook 生產共用。
// 與訂房模組的串接（讓 CS 讀訂房每日入住資料）是訂房 PRO 以上才有的功能，
// 沒有訂房方案或方案不足時直接回 null，讓呼叫端照既有「查無資料」流程處理，不額外洩露方案資訊給訪客。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryBnbCheckin(supabase: any, userId: string, orderNum: string): Promise<string | null> {
  const { features } = await getBookingEntitlements(supabase, userId)
  if (!features.csIntegration) return null

  const todayDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

  // 入住時間（民宿資料可設，預設 15:00）；未到入住時間不提供密碼
  const { before: beforeCheckin, checkinTime, nowHHMM } = await checkBeforeCheckin(supabase, userId)
  const notYetMsg = (label: string) =>
    `【入住資訊查詢結果】\n找到訂單「${orderNum}」${label}，但目前台灣時間 ${nowHHMM} 尚未到入住時間（${checkinTime}）。\n請告知客人：入住時間為今日 ${checkinTime}，請於 ${checkinTime} 後再輸入訂單號碼查詢房門與大門密碼。\n（嚴禁提供任何密碼或房號數字）`

  // 優先：直接從 daily_records 的 order_number 欄位比對
  const { data: rec } = await supabase
    .from('bnb_daily_records')
    .select('room_name, room_password, gate_password, guest_name')
    .eq('user_id', userId)
    .eq('date', todayDate)
    .eq('order_number', orderNum)
    .maybeSingle()

  if (rec) {
    if (beforeCheckin) return notYetMsg('的今日入住資訊')
    const lines = [
      `【入住資訊查詢結果】`,
      `找到訂單「${orderNum}」的今日入住資訊：`,
      rec.guest_name ? `・旅客姓名：${rec.guest_name}` : null,
      `・房間：${rec.room_name || '（尚未設定，請聯繫工作人員）'}`,
      `・房門密碼：${rec.room_password || '（尚未設定，請聯繫工作人員）'}`,
      `・大門密碼：${rec.gate_password || '（尚未設定，請聯繫工作人員）'}`,
      `（以上每一項請逐條列出給客人，不可省略任何一項或濃縮成一句話；資料為系統即時資料，請直接引用，禁止修改或捏造）`,
    ].filter(Boolean).join('\n')
    return lines
  }

  // 備用：從 bookings 查訂單，再交叉查 daily_records。
  // 一張訂單可能訂了多個房型（同一訂單號對應多筆 bookings，見 migration 090），
  // 所以這裡查全部相符的訂單，逐一列出房間與密碼，不能只取第一筆。
  const { data: bookingRows } = await supabase
    .from('bookings')
    .select('property_id, guest_name, check_in, check_out')
    .eq('user_id', userId)
    .eq('platform_booking_id', orderNum)

  // 系統確實有串接訂房功能、也真的查過了，但查無此訂單——一定要明講「查無資料」，
  // 絕對不能讓呼叫端什麼都不回，逼 AI 自己編一組密碼出來給客人。
  // 訂房平台顯示給客人的訂單號，跟平台同步給民宿系統的訂單號常常不是同一組
  // （尤其 Agoda/Booking.com），查無資料時要引導客人改用姓名或電話查詢，而不是叫他再試一次同一組號碼。
  if (!bookingRows?.length) {
    return `【入住資訊查詢結果】\n查無訂單「${orderNum}」的資料，系統中沒有這筆訂單（有些訂房平台顯示給客人的訂單號跟系統收到的不同）。\n（嚴禁提供、推測或捏造任何密碼、房號；請客人改提供訂房姓名或手機號碼再查一次，仍查無資料才轉真人客服）`
  }
  if (beforeCheckin) return notYetMsg('')

  const lines = [
    `【入住資訊查詢結果】`,
    `找到訂單「${orderNum}」：`,
    ...await formatBookingsWithPassword(supabase, userId, bookingRows, todayDate),
  ]
  return lines.join('\n')
}

interface MatchedBookingRow { property_id: string | null; guest_name?: string | null; guest_phone?: string | null; check_in: string; check_out: string; status?: string }

// 把已核對身份的訂單列出房型、入住/退房日期與門鎖密碼（今日的 daily_records）。
// 呼叫端必須先確認「這是唯一一筆、身份已核對相符的訂單」才能呼叫這個函式——
// 匹配到多筆（姓名/電話撞號）時不能呼叫這個函式，只能列出摘要讓客人自己指認，不可洩漏密碼。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function formatBookingsWithPassword(supabase: any, userId: string, rows: MatchedBookingRow[], todayDate: string): Promise<string[]> {
  const lines: string[] = []
  // Airbnb 的日曆同步（iCal）基於隱私政策不會提供真實姓名，guest_name 會是固定字串
  // 「(Not available)」——不能把這個佔位字串當成真實姓名唸給客人聽
  const realName = rows[0].guest_name && rows[0].guest_name !== '(Not available)' ? rows[0].guest_name : ''
  lines.push(realName ? `・旅客姓名：${realName}` : '')
  lines.push(`・入住：${rows[0].check_in}　退房：${rows[0].check_out}`)
  if (rows.length > 1) lines.push(`・共訂了 ${rows.length} 個房型，以下逐一列出：`)

  for (const booking of rows) {
    if (booking.property_id) {
      const { data: prop } = await supabase.from('properties').select('name').eq('id', booking.property_id).maybeSingle()
      if (prop?.name) {
        lines.push(`・房間：${prop.name}`)
        const { data: daily } = await supabase
          .from('bnb_daily_records')
          .select('room_password, gate_password')
          .eq('user_id', userId)
          .eq('date', todayDate)
          .eq('room_name', prop.name)
          .maybeSingle()
        lines.push(`　房門密碼：${daily?.room_password || '（尚未設定，請聯繫工作人員）'}`)
        lines.push(`　大門密碼：${daily?.gate_password || '（尚未設定，請聯繫工作人員）'}`)
      } else {
        lines.push(`・房間密碼：（尚未設定，請聯繫工作人員確認）`)
      }
    } else {
      lines.push(`・房間密碼：（訂單尚未對應房型，請聯繫工作人員確認）`)
    }
  }
  lines.push(`（以上每一項請逐條列出給客人，不可省略任何一項或濃縮成一句話；資料為系統即時資料，請直接引用，禁止修改或捏造）`)
  return lines.filter(Boolean)
}

// 依手機號碼查訂單（比對末 9 碼，容忍 +886 / 0 開頭等格式差異）。
// 手機號碼視為與訂單號碼同等強度的身份憑證——比對到「唯一一筆」訂單即可直接給密碼；
// 比對到多筆（例如同一支手機訂了好幾間房、或號碼太短導致撞號）時，一律只列清單不給密碼，
// 讓客人自己指認是哪一筆，避免把別人的房號密碼給錯人。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryBookingByPhone(supabase: any, userId: string, rawPhone: string): Promise<string | null> {
  const { features } = await getBookingEntitlements(supabase, userId)
  if (!features.csIntegration) return null

  const digits = rawPhone.replace(/\D/g, '')
  if (digits.length < 8) return null
  const suffix = digits.slice(-9)

  const notFoundMsg = `【入住資訊查詢結果】\n查無電話「${rawPhone}」的訂單資料，系統中沒有符合的訂房紀錄。\n（嚴禁提供、推測或捏造任何密碼、房號；請客人改提供訂房姓名或訂單號碼再查一次，仍查無資料才轉真人客服）`

  const todayDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  const past = new Date(); past.setDate(past.getDate() - 3)
  const future = new Date(); future.setDate(future.getDate() + 180)

  const { data: candidates } = await supabase
    .from('bookings')
    .select('property_id, guest_name, guest_phone, check_in, check_out, status')
    .eq('user_id', userId)
    .not('guest_phone', 'is', null)
    .gte('check_in', past.toLocaleDateString('sv-SE'))
    .lte('check_in', future.toLocaleDateString('sv-SE'))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matched = (candidates ?? []).filter((c: any) => (c.guest_phone ?? '').replace(/\D/g, '').endsWith(suffix))
  if (!matched.length) return notFoundMsg

  const { before, checkinTime, nowHHMM } = await checkBeforeCheckin(supabase, userId)
  if (before) {
    return `【入住資訊查詢結果】\n找到電話「${rawPhone}」的訂單，但目前台灣時間 ${nowHHMM} 尚未到入住時間（${checkinTime}）。\n請告知客人：入住時間為今日 ${checkinTime}，請於 ${checkinTime} 後再查詢。\n（嚴禁提供任何密碼或房號數字）`
  }

  if (matched.length > 1) {
    const lines = [`【入住資訊查詢結果】`, `找到 ${matched.length} 筆與電話「${rawPhone}」相符的訂單，請客人提供訂房姓名或訂單號碼以確認是哪一筆：`]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const b of matched.slice(0, 5)) lines.push(`・${b.guest_name ?? '（無姓名）'}｜入住 ${b.check_in} 退房 ${b.check_out}｜狀態：${b.status}`)
    lines.push(`（比對到多筆前，嚴禁提供任何一筆的密碼或房號；務必先讓客人自己指認）`)
    return lines.join('\n')
  }

  const lines = [`【入住資訊查詢結果】`, `找到電話「${rawPhone}」的訂單：`, ...await formatBookingsWithPassword(supabase, userId, matched, todayDate)]
  return lines.join('\n')
}

// 客人只報「訂房大名」、沒有訂單號碼時，依姓名查近期訂單（前 3 天～未來 180 天）。
// 找不到就是找不到，一律回「查無資料」；絕對不能讓 AI 在沒有比對到任何一筆訂單時，
// 自己說「已核對」「訂單已完成處理」等話術給客人。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryBookingByGuestName(supabase: any, userId: string, candidateName: string, model: LanguageModel): Promise<string | null> {
  const { features } = await getBookingEntitlements(supabase, userId)
  if (!features.csIntegration) return null

  const name = candidateName.trim()
  if (!name) return null

  const notFoundMsg = `【訂單查詢結果】\n查無旅客「${name}」的訂單資料，系統中沒有符合的訂房紀錄。\n（嚴禁自行推測或回覆「已找到」「已核對」「訂單已完成處理」等話術；請如實告知客人查無資料，並詢問訂房平台與入住日期，轉真人客服協助查詢）`

  const past = new Date(); past.setDate(past.getDate() - 3)
  const future = new Date(); future.setDate(future.getDate() + 180)
  const pastStr = past.toLocaleDateString('sv-SE')
  const futureStr = future.toLocaleDateString('sv-SE')
  const norm = (s: string) => s.toLowerCase().replace(/[\s./-]/g, '')
  const n = norm(name)

  const fuzzyMatchOne = async <T extends { guest_name: string | null }>(candidates: T[]): Promise<T | null> => {
    try {
      const list = candidates.map((c, i) => `${i}: ${c.guest_name}`).join('\n')
      const { text } = await generateText({
        model,
        messages: [{
          role: 'user',
          content: `客人說他的訂房姓名是：「${name}」\n系統中的訂單旅客姓名列表：\n${list}\n\n請判斷列表中「是否有」與客人所說屬於同一個人的姓名（中文與英文拼音互換、發音相近、姓氏在前或在後皆視為相符）。\n若有，只回傳該筆的編號數字；若都沒有相符的，只回 NONE。不要有其他文字。`,
        }],
      })
      const m = text.trim().match(/^\d+/)
      if (m) {
        const idx = parseInt(m[0], 10)
        if (candidates[idx]) return candidates[idx]
      }
    } catch { /* 比對失敗就當查無資料，不阻斷主流程 */ }
    return null
  }

  // 1. 優先查「每日入住」（bnb_daily_records）——這是民宿自己維護、資料最準確即時的來源，
  // 房號與密碼直接就在同一列，不像 bookings 需要另外查 properties/daily_records 兩層。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dailyCandidates } = await supabase
    .from('bnb_daily_records')
    .select('room_name, guest_name, date, order_number, room_password, gate_password')
    .eq('user_id', userId)
    .not('guest_name', 'is', null)
    .gte('date', pastStr)
    .lte('date', futureStr)

  if (dailyCandidates?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dailyMatched = dailyCandidates.filter((c: any) => {
      const g = norm(c.guest_name ?? '')
      return !!g && (g.includes(n) || n.includes(g))
    })
    if (!dailyMatched.length) {
      const one = await fuzzyMatchOne(dailyCandidates)
      if (one) dailyMatched = [one]
    }

    if (dailyMatched.length) {
      // 同一人、同一組訂單號可能橫跨多間房（同一 LINE 帳號一次訂好幾間房）——
      // 這種情況要視為「同一筆」，全部列出，不算撞號。
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const distinctPeople = new Set(dailyMatched.map((c: any) => `${norm(c.guest_name)}|${c.order_number ?? c.date}`))
      if (distinctPeople.size === 1) {
        const orderNum = dailyMatched[0].order_number
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const group = orderNum ? dailyCandidates.filter((c: any) => c.order_number === orderNum) : dailyMatched

        const { before, checkinTime, nowHHMM } = await checkBeforeCheckin(supabase, userId)
        if (before) {
          return `【訂單查詢結果】\n找到旅客「${name}」的訂單，但目前台灣時間 ${nowHHMM} 尚未到入住時間（${checkinTime}）。\n請告知客人：入住時間為今日 ${checkinTime}，請於 ${checkinTime} 後再查詢。\n（嚴禁提供任何密碼或房號數字）`
        }
        const lines = [`【訂單查詢結果】`, `找到旅客「${name}」的入住資訊：`, `・旅客姓名：${dailyMatched[0].guest_name}`]
        if (group.length > 1) lines.push(`・共訂了 ${group.length} 個房型，以下逐一列出：`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const r of group as any[]) {
          lines.push(`・房間：${r.room_name || '（尚未設定，請聯繫工作人員）'}`)
          lines.push(`　房門密碼：${r.room_password || '（尚未設定，請聯繫工作人員）'}`)
          lines.push(`　大門密碼：${r.gate_password || '（尚未設定，請聯繫工作人員）'}`)
        }
        lines.push(`（以上每一項請逐條列出給客人，不可省略任何一項或濃縮成一句話；資料為系統即時資料，請直接引用，禁止修改或捏造）`)
        return lines.join('\n')
      }

      // 每日入住撞到不同人（同名不同訂單/日期）——不可洩漏，列摘要讓客人自己指認
      const lines: string[] = [`【訂單查詢結果】`, `找到 ${dailyMatched.length} 筆與「${name}」相符的入住紀錄，請客人提供入住日期或訂單號碼以確認是哪一筆：`]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of dailyMatched.slice(0, 5) as any[]) lines.push(`・${r.guest_name}｜${r.room_name || '（未指定房型）'}｜日期 ${r.date}`)
      lines.push(`（比對到多筆前，嚴禁提供任何一筆的密碼或房號；務必先讓客人自己指認）`)
      return lines.join('\n')
    }
  }

  // 2. 每日入住查無資料 → 退回查「訂單」（bookings，訂房模組同步進來的）。
  // Airbnb 的日曆同步基於隱私政策不會給真實姓名（固定回填「(Not available)」），
  // 排除掉，不然這種佔位字串會混進候選名單、也永遠比對不到客人講的真實姓名。
  const { data: candidates } = await supabase
    .from('bookings')
    .select('id, property_id, guest_name, check_in, check_out, status')
    .eq('user_id', userId)
    .not('guest_name', 'is', null)
    .neq('guest_name', '(Not available)')
    .gte('check_in', pastStr)
    .lte('check_in', futureStr)
    .order('check_in', { ascending: true })
    .limit(200)

  if (!candidates?.length) return notFoundMsg

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matched = candidates.filter((c: any) => {
    const g = norm(c.guest_name ?? '')
    return !!g && (g.includes(n) || n.includes(g))
  })

  // 簡單子字串比對不到，才交給 LLM 做模糊比對（中文姓名/拼音互換、姓氏順序），比對失敗一律當查無資料
  if (!matched.length) {
    const one = await fuzzyMatchOne(candidates)
    if (one) matched = [one]
  }

  if (!matched.length) return notFoundMsg

  // 姓名比對到「唯一一筆」——不論是子字串比對還是拼音模糊比對，都視為身份已核對
  // （與資料來源表格的 verifyName 身分核對邏輯一致），可以直接給密碼；
  // 比對到多筆（同名撞號）則不可洩漏，只列摘要讓客人自己指認。
  if (matched.length === 1) {
    const { before, checkinTime, nowHHMM } = await checkBeforeCheckin(supabase, userId)
    if (before) {
      return `【訂單查詢結果】\n找到旅客「${name}」的訂單，但目前台灣時間 ${nowHHMM} 尚未到入住時間（${checkinTime}）。\n請告知客人：入住時間為今日 ${checkinTime}，請於 ${checkinTime} 後再查詢。\n（嚴禁提供任何密碼或房號數字）`
    }
    const todayDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
    const lines = [`【訂單查詢結果】`, `找到旅客「${name}」的訂單：`, ...await formatBookingsWithPassword(supabase, userId, matched, todayDate)]
    return lines.join('\n')
  }

  const lines: string[] = [`【訂單查詢結果】`, `找到 ${matched.length} 筆與「${name}」相符的訂單，請客人提供入住日期或訂單號碼以確認是哪一筆：`]
  for (const b of matched.slice(0, 5)) {
    let roomName = ''
    if (b.property_id) {
      const { data: prop } = await supabase.from('properties').select('name').eq('id', b.property_id).maybeSingle()
      roomName = prop?.name ?? ''
    }
    lines.push(`・${b.guest_name}｜${roomName || '（未指定房型）'}｜入住 ${b.check_in} 退房 ${b.check_out}｜狀態：${b.status}`)
  }
  lines.push(`（比對到多筆前，嚴禁提供任何一筆的密碼或房號；務必先讓客人自己指認）`)
  return lines.join('\n')
}
