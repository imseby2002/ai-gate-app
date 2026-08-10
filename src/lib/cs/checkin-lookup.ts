import { generateText, type LanguageModel } from 'ai'
import { getBookingEntitlements } from '@/lib/booking/entitlements'

// 查無資料時附加在訊息尾巴的固定提示——真實案例：客人給的電話查無資料，AI 自己說
// 「已經請專員儘速人工核對資料，稍後會再與您聯繫」，但這裡根本沒有建立任何工單、
// 沒有通知任何人，客人會白等一場真人回覆永遠不會出現。查無資料的正確處理是「引導
// 客人換一種識別方式再查一次」，不是自稱已經轉真人——只有客人自己明確要求真人客服
// （觸發 HUMAN_ESCALATION_RE）系統才會真的建立工單通知真人。
export function noDataFoundSuffix(altMethods: string): string {
  return `（嚴禁提供、推測或捏造任何密碼、房號；請客人改提供${altMethods}再查一次；嚴禁跟客人說「已經為您安排專員」「已通知專員」「稍後會有人跟您聯繫」等話術——這裡沒有建立任何工單，客人明確要求真人客服時系統才會真的轉真人）`
}

// 姓名核對（模糊比對／圖片辨識）通過前，先跟客人確認候選姓名的固定問句格式——
// 真實案例：客人打「鄭妃君」，LLM 模糊比對成完全不同發音的「Ting Fen Cheng」就直接把
// 密碼給了；另一案例：客人只回「我在門口」（根本不是姓名），LLM 硬猜配對成功，還把「同
// 一組單號」底下全部房型的密碼一次洩漏。姓名比對只要不是「客人自己打的字串」逐字/子字串
// 對上系統資料，一律不能直接洩漏——先用這句固定問法跟客人核對，客人明確承認了，下一輪
// 用這個確認過的姓名重查才能真的給密碼。用固定字串（不是 LLM 自由發揮的句子），才能在
// 下一輪對話用同一個 regex 抓出候選姓名。
export const NAME_VERIFY_ASK_RE = /請問訂房登記的姓名是不是「([^」]{1,40})」呢/

function buildNameVerifyPrompt(candidateName: string): string {
  return `【訂單查詢結果】\n系統找到一筆疑似相符的旅客資料，但姓名不是逐字對上，需要先跟客人核對身份，絕對不能直接提供密碼。\n請一字不改照抄以下這句話回覆客人，不要加其他文字：\n請問訂房登記的姓名是不是「${candidateName}」呢？\n只有客人下一則訊息明確回覆「是/對/沒錯」等肯定語，系統才會在下一輪提供密碼；客人否認、不確定、或給了別的名字，一律不可提供任何密碼、房號，並引導客人改用訂單號碼或手機號碼查詢。`
}

// 圖片辨識出的訂單號碼/姓名終究是 AI 視覺模型的「猜測」，不是客人親自打的資料——即使剛好
// 比對到系統裡一筆真實存在的訂單，也可能是辨識到別人的訂單截圖或不相關的圖片內容（真實
// 案例：客人只是在詢問訂房，自己都還沒訂房，卻因為傳了一張圖片，AI 就把「別人」的旅客
// 姓名與房門密碼整組洩漏出去）。查到資料後一律先跟客人核對是不是本人，不能直接給密碼；
// 跟客人自己打字輸入的訂單號碼／手機號碼（本人主動提供、不經過視覺辨識這層猜測）不同，
// 那兩種管道維持原本直接查詢、不受此限制。
const GUEST_NAME_LINE_RE = /・旅客姓名：([^\n]+)/

export function wrapImageDerivedResultForConfirm(resultText: string): string {
  // 只攔截「真的會洩漏密碼」的查詢結果——查無資料、尚未到入住時間、比對到多筆讓客人自己
  // 指認的清單，這些本來就不含密碼，原樣放行即可，不需要也不該被這裡的邏輯覆蓋掉。
  if (!resultText.includes('房門密碼：')) return resultText
  const m = resultText.match(GUEST_NAME_LINE_RE)
  if (!m?.[1]?.trim()) {
    // 圖片辨識到的訂單沒有登記旅客姓名，沒有東西可以拿來跟客人核對身份，
    // 安全起見不能直接給密碼，請客人改用文字輸入的方式查詢。
    return `【入住資訊查詢結果】\n從圖片中比對到系統裡的訂單資料，但這筆訂單沒有登記旅客姓名，圖片本身也無法作為身份證明，無法直接提供密碼。\n${noDataFoundSuffix('訂單號碼或手機號碼')}`
  }
  return buildNameVerifyPrompt(m[1].trim())
}

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
    return `【入住資訊查詢結果】\n查無訂單「${orderNum}」的資料，系統中沒有這筆訂單（有些訂房平台顯示給客人的訂單號跟系統收到的不同）。\n${noDataFoundSuffix('訂房姓名或手機號碼')}`
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

  const notFoundMsg = `【入住資訊查詢結果】\n查無電話「${rawPhone}」的訂單資料，系統中沒有符合的訂房紀錄。\n${noDataFoundSuffix('訂房姓名或訂單號碼')}`

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
//
// confirmedExactName：客人已經針對某個候選姓名明確回覆「是/對」之後，下一輪重查時傳入，
// 代表這個姓名已經跟客人核對過、不必再走模糊比對，也不必再問一次——傳入時只接受逐字/
// 子字串比對（等同精準比對），絕對不會再觸發 LLM 模糊比對。
//
// 真實案例：客人打「鄭妃君」，LLM 模糊比對配對到完全不同發音的「Ting Fen Cheng」就直接
// 給密碼；另一案例：客人只回「我在門口」（根本不是姓名），LLM 硬猜配對成功，還把「同一組
// 訂單號」底下全部房型（含不相干的其他客人）的密碼一次洩漏——因此模糊比對（LLM 猜測）
// 一律不能直接洩漏，只能先跟客人核對候選姓名；只有客人「自己打的字串」逐字/子字串比對到
// 系統資料，或客人已經核對確認過的姓名，才視為身份已驗證可以直接給密碼。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryBookingByGuestName(supabase: any, userId: string, candidateName: string, model: LanguageModel, confirmedExactName?: string): Promise<string | null> {
  const { features } = await getBookingEntitlements(supabase, userId)
  if (!features.csIntegration) return null

  const name = candidateName.trim()
  if (!name) return null
  const allowFuzzy = !confirmedExactName
  const lookupName = (confirmedExactName ?? candidateName).trim()
  if (!lookupName) return null

  const notFoundMsg = `【訂單查詢結果】\n查無旅客「${name}」的訂單資料，系統中沒有符合的訂房紀錄。\n（嚴禁自行推測或回覆「已找到」「已核對」「訂單已完成處理」等話術）\n${noDataFoundSuffix('訂單號碼或手機號碼')}`

  const past = new Date(); past.setDate(past.getDate() - 3)
  const future = new Date(); future.setDate(future.getDate() + 180)
  const pastStr = past.toLocaleDateString('sv-SE')
  const futureStr = future.toLocaleDateString('sv-SE')
  const norm = (s: string) => s.toLowerCase().replace(/[\s./-]/g, '')
  const n = norm(lookupName)

  const fuzzyMatchOne = async <T extends { guest_name: string | null }>(candidates: T[]): Promise<T | null> => {
    try {
      const list = candidates.map((c, i) => `${i}: ${c.guest_name}`).join('\n')
      const { text } = await generateText({
        model,
        messages: [{
          role: 'user',
          content: `客人說他的訂房姓名是：「${lookupName}」\n系統中的訂單旅客姓名列表：\n${list}\n\n請嚴格判斷列表中「是否有」與客人所說明確屬於同一個人的姓名（中文與英文拼音互換、發音真的相近、姓氏在前或在後皆可視為相符）。客人說的內容如果根本不像是一個人名（例如是一句話、確認詞、地點描述等），或發音差異明顯，一律回 NONE，寧可漏掉也不要亂猜。\n若有明確相符的，只回傳該筆的編號數字；否則只回 NONE。不要有其他文字。`,
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
    if (!dailyMatched.length && allowFuzzy) {
      const one = await fuzzyMatchOne(dailyCandidates)
      if (one) dailyMatched = [one]
    }

    if (dailyMatched.length) {
      // 同一人、同一組訂單號可能橫跨多間房（同一 LINE 帳號一次訂好幾間房）——
      // 這種情況要視為「同一筆」，全部列出，不算撞號。
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const distinctPeople = new Set(dailyMatched.map((c: any) => `${norm(c.guest_name)}|${c.order_number ?? c.date}`))
      if (distinctPeople.size === 1) {
        // 只有「客人打的字串」逐字對上系統姓名（或這是客人已核對確認過的姓名）才視為身份
        // 已驗證可以直接洩漏；只要是子字串比對或 LLM 模糊猜測、不是完全一樣，一律先跟客人
        // 核對候選姓名——真實案例：客人打「鄭妃君」，模糊比對配對到完全不同發音的
        // 「Ting Fen Cheng」就直接把密碼給了。
        if (norm(dailyMatched[0].guest_name ?? '') !== n) return buildNameVerifyPrompt(dailyMatched[0].guest_name)
        const orderNum = dailyMatched[0].order_number
        // 同一組訂單號涵蓋的房型全部列出——客人可能包棟或一次訂多間房，身份已經逐字核對過
        // （見上面的 exact-match 檢查），不再另外用房間數量設上限卡住合法的多房訂單。
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const group = orderNum ? dailyCandidates.filter((c: any) => c.order_number === orderNum) : dailyMatched

        const { before, checkinTime, nowHHMM } = await checkBeforeCheckin(supabase, userId)
        if (before) {
          return `【訂單查詢結果】\n找到旅客「${lookupName}」的訂單，但目前台灣時間 ${nowHHMM} 尚未到入住時間（${checkinTime}）。\n請告知客人：入住時間為今日 ${checkinTime}，請於 ${checkinTime} 後再查詢。\n（嚴禁提供任何密碼或房號數字）`
        }
        const lines = [`【訂單查詢結果】`, `找到旅客「${lookupName}」的入住資訊：`, `・旅客姓名：${dailyMatched[0].guest_name}`]
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
      const lines: string[] = [`【訂單查詢結果】`, `找到 ${dailyMatched.length} 筆與「${lookupName}」相符的入住紀錄，請客人提供入住日期或訂單號碼以確認是哪一筆：`]
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
  if (!matched.length && allowFuzzy) {
    const one = await fuzzyMatchOne(candidates)
    if (one) matched = [one]
  }

  if (!matched.length) return notFoundMsg

  // 姓名比對到「唯一一筆」——但只有客人打的字串跟系統姓名逐字一樣（或這是客人已核對確認
  // 過的姓名）才視為身份已核對可以直接給密碼；子字串比對或 LLM 模糊猜測只要不是完全一樣，
  // 一律先跟客人核對候選姓名。比對到多筆（同名撞號）也不可洩漏，只列摘要讓客人自己指認。
  if (matched.length === 1) {
    if (norm(matched[0].guest_name ?? '') !== n) return buildNameVerifyPrompt(matched[0].guest_name)
    const { before, checkinTime, nowHHMM } = await checkBeforeCheckin(supabase, userId)
    if (before) {
      return `【訂單查詢結果】\n找到旅客「${lookupName}」的訂單，但目前台灣時間 ${nowHHMM} 尚未到入住時間（${checkinTime}）。\n請告知客人：入住時間為今日 ${checkinTime}，請於 ${checkinTime} 後再查詢。\n（嚴禁提供任何密碼或房號數字）`
    }
    const todayDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
    const lines = [`【訂單查詢結果】`, `找到旅客「${lookupName}」的訂單：`, ...await formatBookingsWithPassword(supabase, userId, matched, todayDate)]
    return lines.join('\n')
  }

  const lines: string[] = [`【訂單查詢結果】`, `找到 ${matched.length} 筆與「${lookupName}」相符的訂單，請客人提供入住日期或訂單號碼以確認是哪一筆：`]
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
