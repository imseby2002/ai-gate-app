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

  // 備用：從 bookings 查訂單，再交叉查 daily_records
  const { data: booking } = await supabase
    .from('bookings')
    .select('property_id, guest_name, check_in, check_out')
    .eq('user_id', userId)
    .eq('platform_booking_id', orderNum)
    .maybeSingle()

  // 系統確實有串接訂房功能、也真的查過了，但查無此訂單——一定要明講「查無資料」，
  // 絕對不能讓呼叫端什麼都不回，逼 AI 自己編一組密碼出來給客人。
  if (!booking) {
    return `【入住資訊查詢結果】\n查無訂單「${orderNum}」的資料，系統中沒有這筆訂單。\n（嚴禁提供、推測或捏造任何密碼、房號；請詢問旅客訂房姓名與訂房平台，轉交真人客服協助查詢）`
  }
  if (beforeCheckin) return notYetMsg('')

  const lines: string[] = [
    `【入住資訊查詢結果】`,
    `找到訂單「${orderNum}」：`,
    booking.guest_name ? `・旅客姓名：${booking.guest_name}` : null,
    `・入住：${booking.check_in}　退房：${booking.check_out}`,
  ].filter(Boolean) as string[]

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
      lines.push(`・房門密碼：${daily?.room_password || '（尚未設定，請聯繫工作人員）'}`)
      lines.push(`・大門密碼：${daily?.gate_password || '（尚未設定，請聯繫工作人員）'}`)
    } else {
      lines.push(`・房間密碼：（尚未設定，請聯繫工作人員確認）`)
    }
  } else {
    lines.push(`・房間密碼：（訂單尚未對應房型，請聯繫工作人員確認）`)
  }

  lines.push(`（以上每一項請逐條列出給客人，不可省略任何一項或濃縮成一句話；資料為系統即時資料，請直接引用，禁止修改或捏造）`)
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

  const { data: candidates } = await supabase
    .from('bookings')
    .select('id, property_id, guest_name, check_in, check_out, status')
    .eq('user_id', userId)
    .not('guest_name', 'is', null)
    .gte('check_in', past.toLocaleDateString('sv-SE'))
    .lte('check_in', future.toLocaleDateString('sv-SE'))
    .order('check_in', { ascending: true })
    .limit(200)

  if (!candidates?.length) return notFoundMsg

  const norm = (s: string) => s.toLowerCase().replace(/[\s./-]/g, '')
  const n = norm(name)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matched = candidates.filter((c: any) => {
    const g = norm(c.guest_name ?? '')
    return !!g && (g.includes(n) || n.includes(g))
  })

  // 簡單子字串比對不到，才交給 LLM 做模糊比對（中文姓名/拼音互換、姓氏順序），比對失敗一律當查無資料
  if (!matched.length) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = candidates.map((c: any, i: number) => `${i}: ${c.guest_name}`).join('\n')
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
        if (candidates[idx]) matched = [candidates[idx]]
      }
    } catch { /* 比對失敗就當查無資料，不阻斷主流程 */ }
  }

  if (!matched.length) return notFoundMsg

  const lines: string[] = [`【訂單查詢結果】`, `找到 ${matched.length} 筆與「${name}」相符的訂單：`]
  for (const b of matched.slice(0, 5)) {
    let roomName = ''
    if (b.property_id) {
      const { data: prop } = await supabase.from('properties').select('name').eq('id', b.property_id).maybeSingle()
      roomName = prop?.name ?? ''
    }
    lines.push(`・${b.guest_name}｜${roomName || '（未指定房型）'}｜入住 ${b.check_in} 退房 ${b.check_out}｜狀態：${b.status}`)
  }
  lines.push(`（以上為系統即時查詢結果，請直接引用；若客人提供的資訊與上方不符，請如實告知差異，不可硬說已核對成功）`)
  return lines.join('\n')
}
