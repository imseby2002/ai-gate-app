// Google Sheets 外部資料表查詢：供 cs-chat（測試分頁）與 cs-webhook（正式頻道）共用。
//
// 兩處先前各自維護一份，已經走鐘：
// - 比對能力：cs-chat 支援多欄位 key（逗號分隔、OR 邏輯）+ 找不到時全欄位掃描 fallback，
//   webhook 只支援單一欄位；cs-chat 另有「整則訊息就是訂單號」的必觸發 fallback。
// - 查詢失敗訊息：cs-chat 對外部 API 失敗/例外會回一段話讓 AI 誠實告知客戶「系統忙碌」，
//   webhook 直接回 null（等於讓 AI 在完全沒有資料的情況下自由發揮）。
// - 敏感欄位（密碼/房號等）身分核對：webhook 沒有姓名欄位可核對時預設「遮蔽」（fail closed），
//   cs-chat 沒有姓名欄位時預設「放行」（temporary mode）。這裡採用 webhook 較嚴格的版本，
//   避免正式頻道的既有安全性因合併而降低。
export interface SheetConfig {
  apiKey: string
  spreadsheetId: string
  sheetName: string
  keyColumn: string
  returnColumns: string[]
  triggerKeywords: string[]
  triggerMode?: 'keyword' | 'numeric' | 'both'
}

// Matches numbers with 8+ digits, not starting with 0, not preceded by +
const NUMERIC_ORDER_RE = /(?<!\+)\b[1-9]\d{7,}\b/

// Columns whose values must NOT be revealed until the requester's identity is verified.
// (Order number alone is guessable → prevents IDOR on door codes / room numbers.)
const SENSITIVE_COL_RE = /密碼|password|passcode|\bpin\b|房號|room\s*(no|number|#)?|門鎖|門禁|鎖|鑰匙|\bkey\b|wifi|wi-?fi/i
// Column that holds the guest name, used as the verification factor.
const NAME_COL_RE = /姓名|名字|訂房人|訂位人|入住人|旅客|客戶|貴賓|聯絡人|\bname\b|guest|customer/i

export interface SheetQueryOpts {
  conversationText?: string
  verifyName?: (storedName: string, conversationText: string) => Promise<boolean>
}

export async function queryGoogleSheet(config: SheetConfig, message: string, opts: SheetQueryOpts = {}): Promise<string | null> {
  const triggerMode = config.triggerMode ?? 'keyword'
  let triggered = false

  // Always extract numeric key so precise row lookup works even in keyword mode
  const numMatch = message.match(NUMERIC_ORDER_RE)
  const exactKey: string | null = numMatch ? numMatch[0] : null

  if (triggerMode === 'keyword' || triggerMode === 'both') {
    if (config.triggerKeywords.some(kw => kw.trim() && message.toLowerCase().includes(kw.trim().toLowerCase()))) {
      triggered = true
    }
  }

  if (triggerMode === 'numeric' || triggerMode === 'both') {
    if (exactKey) triggered = true
  }

  // Fallback: if the entire message IS the order number (user pasted it alone),
  // always trigger regardless of triggerMode — avoids [密碼] placeholder replies
  if (!triggered && exactKey && message.trim() === exactKey) {
    triggered = true
  }

  if (!triggered) return null

  try {
    const range = encodeURIComponent(`${config.sheetName}!A:Z`)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}?key=${config.apiKey}`
    const res = await fetch(url)
    if (!res.ok) {
      // Do not leak raw upstream error text to the customer-facing context
      return `【外部資料表：${config.sheetName}】\n（系統提示：資料查詢暫時無法使用，請告知客戶系統忙碌、稍後再試或聯繫工作人員，禁止捏造任何資料。）`
    }

    const json = await res.json()
    const rows: string[][] = json.values ?? []
    if (rows.length < 2) return null

    const headers = rows[0]
    const dataRows = rows.slice(1)

    // Normalize cell values: convert to string, strip thousand-separator commas
    // Google Sheets API may return numbers as "202,202,202" or plain "202202202"
    const cellStr = (v: unknown): string => String(v ?? '').replace(/,/g, '').trim()

    // 支援多欄位查詢（逗號分隔），OR 邏輯
    const keyColumnNames = (config.keyColumn ?? '').split(',').map(c => c.trim()).filter(Boolean)
    const keyColIdxs = keyColumnNames.map(c => headers.findIndex(h => h.trim() === c)).filter(i => i >= 0)

    if (exactKey) {
      // Helper: find row by scanning given column indices
      const findRow = (idxs: number[]) =>
        dataRows.find(row => idxs.some(idx => cellStr(row[idx]) === exactKey!.trim()))

      // Primary search: key column(s) if configured and found in headers
      const primaryIdxs = keyColIdxs.length > 0 ? keyColIdxs : headers.map((_, i) => i)
      let matchedRow = findRow(primaryIdxs)

      // Secondary fallback: scan ALL columns (handles header name mismatch)
      if (!matchedRow && keyColIdxs.length > 0) {
        matchedRow = findRow(headers.map((_, i) => i))
      }

      if (!matchedRow) {
        return `【外部資料表：${config.sheetName}】\n查無符合「${exactKey}」的資料，請確認號碼是否正確。`
      }

      // ── Identity gate on sensitive columns (door code / room number) ──────
      // Order numbers are guessable, so revealing door codes on a bare number
      // is an IDOR. Fail closed: without a name column to verify against, or
      // without a successful fuzzy match, sensitive columns stay masked.
      const sensitiveIdxs = headers.map((h, i) => SENSITIVE_COL_RE.test(h ?? '') ? i : -1).filter(i => i >= 0)
      const nameIdx = headers.findIndex(h => NAME_COL_RE.test(h ?? ''))
      const storedName = nameIdx >= 0 ? cellStr(matchedRow[nameIdx]) : ''

      let verified = true
      let gateNote = ''
      if (sensitiveIdxs.length > 0) {
        verified = (opts.verifyName && storedName)
          ? await opts.verifyName(storedName, opts.conversationText ?? '')
          : false
        if (!verified) {
          gateNote = storedName
            ? `\n（⚠️ 身分未核對：上方密碼/房號/門鎖等敏感欄位已遮蔽。請客人提供「訂房時登記的姓名」，系統會自動核對；核對相符前，嚴禁透露任何密碼、房號、門鎖、鑰匙資訊。）`
            : `\n（⚠️ 此資料表無可核對的姓名欄位，無法驗證身分。涉及密碼/房號等敏感資訊請改由真人客服協助，嚴禁透露。）`
        }
      }

      // Return columns (mask sensitive ones until verified) — prevents fabrication
      const result = headers.map((h, i) => {
        const masked = !verified && sensitiveIdxs.includes(i)
        const val = masked ? '（需核對姓名後提供）' : (matchedRow![i] ?? '')
        return `${h}：${val}`
      }).filter(l => {
        const val = l.split('：').slice(1).join('：').trim()
        return val !== ''
      }).join('\n')
      return `【外部資料表：${config.sheetName}】\n找到「${exactKey}」的資料：\n${result}\n（以上為此訂單資料，請直接引用，禁止修改或捏造任何數值）${gateNote}`
    }

    // Keyword trigger: return full filtered table
    const wantedCols = [config.keyColumn, ...(config.returnColumns ?? [])].filter(Boolean)
    const colIdxs = wantedCols.length > 0
      ? wantedCols.map(c => headers.findIndex(h => h.trim() === c.trim())).filter(i => i >= 0)
      : headers.map((_, i) => i)

    const pickedHeaders = colIdxs.map(i => headers[i])
    const pickedRows = dataRows.map(row => colIdxs.map(i => row[i] ?? ''))

    const table = [pickedHeaders, ...pickedRows]
      .map(r => r.join(' | '))
      .join('\n')

    return `【外部資料表：${config.sheetName}】\n${table}`
  } catch {
    // Do not leak internal exception details to the customer-facing context
    return `【外部資料表：${config.sheetName}】\n（系統提示：資料查詢發生異常，請告知客戶稍後再試或聯繫工作人員，禁止捏造任何資料。）`
  }
}
