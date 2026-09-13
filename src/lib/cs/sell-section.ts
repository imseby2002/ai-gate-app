// 客戶識別 + 業務話術區塊：供 cs-chat（測試分頁）與 cs-webhook（正式頻道）共用。
//
// 先前 cs-chat 是內嵌在 handlePost 裡的簡化版（只認姓名/摘要/猶豫關鍵字/問價次數），
// webhook 的 buildSellSection 是實際客人調校過的完整版，多了：已登記的行程參加者
// 名單（防止重複索取身分證/生日）、已核對過的身分事實（訂單號碼/電話等）、優惠
// 一次性追蹤（discount_offered_at，防止同一對話重複給優惠）。統一採用 webhook
// 版本，讓測試分頁看到的業務話術跟真實客人一致。
export type CsCustomerRow = {
  name: string | null
  summary: string | null
  stage: string | null
  price_ask_count: number
  message_count: number
  discount_offered_at: string | null
  facts: Record<string, any> | null
}

// 偵測猶豫關鍵字
const HESITATION_RE = /考慮|再想想|比較|猶豫|還沒決定|再看看|回頭|之後再|有點貴|太貴|划算|值得嗎|其他家|別家|下次|想一下|想想看|不確定|先問問|問一下/

// 業務輔助只在客人猶豫時才啟動；平時只保留客戶上下文
export function buildSellSection(cust: CsCustomerRow | null, convoPriceAsks: number, isPriceAskNow: boolean, currentMessage: string): string {
  const lines: string[] = []

  // 客戶記憶：永遠保留（不影響話術）
  if (cust?.name) lines.push(`\n\n客戶稱呼：${cust.name}，請自然稱呼對方。`)

  // 檢查是否有已登記的行程參加者名單（身分證字號、姓名、生日）
  let hasRegisteredParticipants = false
  if (cust?.facts?.participants) {
    try {
      const parts = typeof cust.facts.participants === 'string'
        ? JSON.parse(cust.facts.participants)
        : cust.facts.participants
      if (Array.isArray(parts) && parts.length > 0) {
        hasRegisteredParticipants = true
        lines.push(`\n\n【已登記的行程參加者與投保名單——資料已齊全，絕對禁止重複向客人索取！】`)
        lines.push(`已登記參加者清單：`)
        parts.forEach((p: any, idx: number) => {
          lines.push(`${idx + 1}. 姓名：${p.name || '已登記'}，身分證字號：${p.idNumber || '已登記'}，出生年月日：${p.birthday || '已登記'}`)
        })
        if (cust.facts.phone) lines.push(`已登記聯絡電話：${cust.facts.phone}`)
        lines.push(`【極重要死命令】上述參加者名單與個資已經全部建檔齊全！絕對禁止再要求客人提供身分證、生日、姓名或電話！客人回報已匯款、回報末五碼或傳送匯款截圖時，請直接親切確認已收到款項，說明管家會人工對帳，行程已為您保留，切勿再索取任何參加者資料！`)
      }
    } catch { /* parse error ignored */ }
  }

  if (cust?.summary) {
    let cleanSummary = cust.summary
    if (hasRegisteredParticipants && /等待.*(?:姓名|身分證|名單|生日)/.test(cleanSummary)) {
      cleanSummary = cleanSummary.replace(/目前?等待客人提供.*?([。，,.]|$)/g, '參加者資料已全數登記完成。')
    }
    lines.push(`回頭客背景：「${cleanSummary}」，勿重問已知資訊。`)
  }

  // 已核對過的身分事實（訂單號碼/電話/訂房大名/行程資訊）
  const factLabels: Record<string, string> = { confirmedName: '訂房大名', orderNumber: '訂單號碼', phone: '手機號碼', tour: '預訂行程', tourDate: '行程時間', tourTotal: '行程金額', paymentStatus: '款項狀態' }
  const factEntries = Object.entries(cust?.facts ?? {}).filter(([k, v]) => v && k !== 'participants' && typeof v === 'string')
  if (factEntries.length) {
    lines.push(`\n\n【客人已核對過的身分與預訂資訊——不用再詢問或請客人重新提供，需要查詢資料時可直接使用】\n${factEntries.map(([k, v]) => `${factLabels[k] ?? k}：${v}`).join('\n')}`)
  }

  // 偵測猶豫：關鍵字 OR 第 2 次以上問價 OR 已在 negotiating 階段
  const isHesitating = HESITATION_RE.test(currentMessage) || convoPriceAsks >= 2 || cust?.stage === 'negotiating'

  if (isHesitating) {
    lines.push(cust?.discount_offered_at
      ? '\n\n【客戶正在猶豫——業務指引】這位客人這次對話已經拿過一次優惠了（見下方標記），同理客戶的考量、簡短說明品質或特色解答疑慮，簡短回答，不施壓，篇幅務必精簡，優惠一個對話只能給一次。'
      : '\n\n【客戶正在猶豫——業務指引】同理客戶的考量，簡短解答真正顧慮，提供一個具體建議或解法。語氣溫暖，不施壓，篇幅務必精簡，不要過度推銷。')
  }

  // 報價提示：只在未得知日期且需要推薦時才問，否則報價完即結束
  if (isPriceAskNow && !isHesitating) {
    lines.push('\n\n【報價提醒】回答報價直截了當。若對話中完全未提及入住日期且需要推薦方案，才簡短詢問「預計哪天入住呢？」；若對話或客情中已有日期，或客人只是單純詢問某房型價格，報價完即停止，禁止多餘追問。')
  }

  return lines.join('\n')
}
