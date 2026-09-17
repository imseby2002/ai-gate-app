// 解析 Zero（帳務小管家）記帳軟體的 .mdb 資料庫，轉換成 hr_cashflow 與 fin_subjects 可匯入的交易列與科目。
//
// Zero 的核心表 MYMONEY_DATA 以 (ACCOUNT_ID, MAKE_NO) 分組，每組固定 2 列，
// 代表一筆複式記帳分錄：資產+支出（一般消費）、資產+收入（收款入帳）、
// 資產+資產（帳戶間轉帳）。ITEM_DATA 是科目主檔，PARENT_NOTE 是科目大類。
import MDBReader, { type Value } from 'mdb-reader'

export interface ZeroTransaction {
  type: 'income' | 'expense' | 'transfer'
  date: string // YYYY-MM-DD
  amount: number
  category: string
  category_parent: string
  description: string
  notes: string
  pay_coll_name: string
  invoice_no: string
  account_name: string
  to_account_name?: string
  external_ref: string
}

export interface ZeroSubject {
  account_book: string
  class: 'asset' | 'liability' | 'income' | 'expense' | 'equity' | 'other'
  raw_class: string
  parent_name: string
  name: string
  initial_balance: number
  sort_order: number
  style: string
  zero_view: boolean
  is_account: boolean
}

export interface MdbErrorInfo {
  id: string
  make_no: number
  account_id: number
  date: string
  type: 'NO_ASSET_ROW' | 'YEAR_OUT_OF_RANGE' | 'INVALID_RECORD_COUNT' | 'ZERO_AMOUNT' | 'UNPARSEABLE_DATE' | 'UNKNOWN_CLASS' | 'MISSING_DATA'
  severity: 'error' | 'warning'
  title: string
  description: string
  suggested_fix: string
  raw_rows: {
    make_no: number
    date: string
    item_class: string
    item_note: string
    in_mount: number
    out_mount: number
    data_note: string
    pay_coll_name?: string
  }[]
}

export interface ZeroParseResult {
  bookName: string
  subjects: ZeroSubject[]
  transactions: ZeroTransaction[]
  skipped: number
  accountNames: string[]
  dateRange: [string, string] | null
  totalIncome: number
  totalExpense: number
  bookCount: number
  dateWarnings: number
  errors: MdbErrorInfo[]
  errorCount: number
  warningCount: number
}

interface MoneyRow {
  [key: string]: Value
  ACCOUNT_ID: number
  MAKE_NO: number
  ITEM_CLASS: string
  DATA_DATE: string
  ITEM_NOTE: string
  IN_MOUNT: number
  OUT_MOUNT: number
  DATA_NOTE: string
  INVOICE_NO: string
  PAY_COLL_NAME: string
  DATA_NOTE2: string
  DATA_KEY: string
}

interface ItemRow {
  [key: string]: Value
  ITEM_NOTE: string
  ITEM_CLASS: string
  PARENT_NOTE: string
  BEFORE_MOUNT: Value
  MAKE_NO: Value
  ITEM_STYLE: Value
  ZERO_VIEW: Value
}

const t = (v: unknown) => String(v ?? '').trim()

export function mapItemClass(raw: string): 'asset' | 'liability' | 'income' | 'expense' | 'equity' | 'other' {
  const s = raw.trim()
  if (s === '資產') return 'asset'
  if (s === '負債') return 'liability'
  if (s === '收入' || s === '業外收入') return 'income'
  if (s === '支出' || s === '業外支出') return 'expense'
  if (s === '業主權益' || s === '資本' || s === '淨值') return 'equity'
  return 'other'
}

function parseZeroDate(raw: string): string | null {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(t(raw))
  if (!m) return null
  const [, y, mo, d] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export function parseZeroMdb(buffer: Buffer): ZeroParseResult {
  const reader = new MDBReader(buffer)
  const tableNames = reader.getTableNames()

  // 帳本名稱（來自 NOTEPAD_DATA 或預設 FT）
  let bookName = 'FT'
  if (tableNames.includes('NOTEPAD_DATA')) {
    const notepad = reader.getTable('NOTEPAD_DATA').getData<{ ACCOUNT_NOTE?: string }>()
    if (notepad.length > 0 && notepad[0].ACCOUNT_NOTE) {
      bookName = t(notepad[0].ACCOUNT_NOTE) || 'FT'
    }
  }

  const money = tableNames.includes('MYMONEY_DATA') ? reader.getTable('MYMONEY_DATA').getData<MoneyRow>() : []
  const items = tableNames.includes('ITEM_DATA') ? reader.getTable('ITEM_DATA').getData<ItemRow>() : []

  // 1. 自動解析與建置科目清單（ITEM_DATA）
  const subjects: ZeroSubject[] = []
  const parentMap = new Map<string, string>()
  for (const it of items) {
    const rawClass = t(it.ITEM_CLASS)
    const name = t(it.ITEM_NOTE)
    const parent_name = t(it.PARENT_NOTE)
    if (!name) continue
    parentMap.set(`${rawClass}|${name}`, parent_name)

    const mappedClass = mapItemClass(rawClass)
    subjects.push({
      account_book: bookName,
      class: mappedClass,
      raw_class: rawClass,
      parent_name,
      name,
      initial_balance: Number(it.BEFORE_MOUNT) || 0,
      sort_order: Number(it.MAKE_NO) || 0,
      style: t(it.ITEM_STYLE) || '常態性',
      zero_view: t(it.ZERO_VIEW).toUpperCase() !== 'N',
      is_account: mappedClass === 'asset' || mappedClass === 'liability',
    })
  }

  // 2. 解析分錄
  const groups = new Map<string, MoneyRow[]>()
  const books = new Set<number>()
  for (const r of money) {
    books.add(r.ACCOUNT_ID)
    const key = `${r.ACCOUNT_ID}|${r.MAKE_NO}`
    const arr = groups.get(key)
    if (arr) arr.push(r); else groups.set(key, [r])
  }

  const transactions: ZeroTransaction[] = []
  const accountNames = new Set<string>()
  const errors: MdbErrorInfo[] = []
  let skipped = 0
  let minDate = '', maxDate = ''
  let totalIncome = 0, totalExpense = 0
  let dateWarnings = 0

  const PLAUSIBLE_YEAR_MIN = 2000
  const PLAUSIBLE_YEAR_MAX = new Date().getFullYear() + 2

  const formatRows = (rows: MoneyRow[]) => rows.map(r => ({
    make_no: r.MAKE_NO,
    date: t(r.DATA_DATE),
    item_class: t(r.ITEM_CLASS),
    item_note: t(r.ITEM_NOTE),
    in_mount: Number(r.IN_MOUNT) || 0,
    out_mount: Number(r.OUT_MOUNT) || 0,
    data_note: t(r.DATA_NOTE),
    pay_coll_name: t(r.PAY_COLL_NAME) || undefined,
  }))

  for (const [groupKey, rows] of groups.entries()) {
    const [accountIdStr, makeNoStr] = groupKey.split('|')
    const account_id = Number(accountIdStr) || 0
    const make_no = Number(makeNoStr) || 0

    // 檢驗複式記帳列數
    if (rows.length !== 2) {
      skipped += rows.length
      errors.push({
        id: `err-${groupKey}`,
        make_no, account_id,
        date: rows[0] ? t(rows[0].DATA_DATE) : '',
        type: 'INVALID_RECORD_COUNT',
        severity: 'error',
        title: `分錄列數不完整（實際 ${rows.length} 列，預期成對 2 列）`,
        description: `複式記帳每筆交易必須包含借貸兩列。目前有 ${rows.length} 列，可能在原軟體中被單邊刪除或資料損毀。`,
        suggested_fix: `請於 Zero.Net 檢查流水號 #${make_no} 的分錄完整性。`,
        raw_rows: formatRows(rows),
      })
      continue
    }

    const [a, b] = rows
    const dateRaw = t(a.DATA_DATE)
    const date = parseZeroDate(dateRaw)
    if (!date) {
      skipped += 2
      errors.push({
        id: `err-${groupKey}`,
        make_no, account_id,
        date: dateRaw,
        type: 'UNPARSEABLE_DATE',
        severity: 'error',
        title: `日期格式錯誤無法解析（"${dateRaw}"）`,
        description: `分錄日期未符合 YYYY/MM/DD 格式，系統無法確認正確記帳日期。`,
        suggested_fix: `請於 Zero.Net 中開啟流水號 #${make_no} 並重新填寫日期。`,
        raw_rows: formatRows(rows),
      })
      continue
    }

    // 年份合理性警告（異常年仍匯入，但提示給使用者）
    const year = Number(date.slice(0, 4))
    if (year < PLAUSIBLE_YEAR_MIN || year > PLAUSIBLE_YEAR_MAX) {
      dateWarnings++
      errors.push({
        id: `warn-${groupKey}`,
        make_no, account_id,
        date: dateRaw,
        type: 'YEAR_OUT_OF_RANGE',
        severity: 'warning',
        title: `日期年份疑似筆誤（${year}年）`,
        description: `分錄項目為「${t(a.ITEM_NOTE)}」與「${t(b.ITEM_NOTE)}」，備註為「${t(a.DATA_NOTE) || t(b.DATA_NOTE)}」，日期為 "${dateRaw}"。該資料仍已成功匯入，但建議核對。`,
        suggested_fix: `請在 Zero.Net 或本系統中修改年份為正確西元年。`,
        raw_rows: formatRows(rows),
      })
    } else {
      if (!minDate || date < minDate) minDate = date
      if (!maxDate || date > maxDate) maxDate = date
    }

    const assetRow = t(a.ITEM_CLASS) === '資產' ? a : (t(b.ITEM_CLASS) === '資產' ? b : null)
    if (!assetRow) {
      skipped += 2
      errors.push({
        id: `err-${groupKey}`,
        make_no, account_id,
        date: dateRaw,
        type: 'NO_ASSET_ROW',
        severity: 'error',
        title: `分錄缺少資產項目（雙方類別為「${t(a.ITEM_CLASS)}」與「${t(b.ITEM_CLASS)}」）`,
        description: `分錄一列為「${t(a.ITEM_CLASS)} - ${t(a.ITEM_NOTE)}」，另一列為「${t(b.ITEM_CLASS)} - ${t(b.ITEM_NOTE)}」，無任何資產資金帳戶，無法判定資金流向。`,
        suggested_fix: `請於 Zero.Net 檢查流水號 #${make_no}，將其中一列指定為正確的收付款帳戶。`,
        raw_rows: formatRows(rows),
      })
      continue
    }

    const otherRow = assetRow === a ? b : a

    if (t(otherRow.ITEM_CLASS) === '資產') {
      // 帳戶間轉帳：一列轉出（OUT_MOUNT）、一列轉入（IN_MOUNT）
      const fromRow = a.OUT_MOUNT > 0 ? a : b
      const toRow = fromRow === a ? b : a
      const amount = Math.abs(fromRow.OUT_MOUNT) || Math.abs(toRow.IN_MOUNT)
      if (!amount) {
        skipped += 2
        errors.push({
          id: `err-${groupKey}`,
          make_no, account_id,
          date: dateRaw,
          type: 'ZERO_AMOUNT',
          severity: 'error',
          title: `轉帳金額為 0`,
          description: `從「${t(fromRow.ITEM_NOTE)}」轉至「${t(toRow.ITEM_NOTE)}」之金額為 0，已略過匯入。`,
          suggested_fix: `若此筆為有效轉帳，請於 Zero.Net 補上金額。`,
          raw_rows: formatRows(rows),
        })
        continue
      }
      accountNames.add(t(fromRow.ITEM_NOTE))
      accountNames.add(t(toRow.ITEM_NOTE))
      transactions.push({
        type: 'transfer', date, amount,
        category: '', category_parent: '',
        description: t(fromRow.DATA_NOTE) || t(toRow.DATA_NOTE),
        notes: t(fromRow.DATA_NOTE2) || t(toRow.DATA_NOTE2),
        pay_coll_name: t(fromRow.PAY_COLL_NAME) || t(toRow.PAY_COLL_NAME),
        invoice_no: t(fromRow.INVOICE_NO) || t(toRow.INVOICE_NO),
        account_name: t(fromRow.ITEM_NOTE),
        to_account_name: t(toRow.ITEM_NOTE),
        external_ref: t(fromRow.DATA_KEY),
      })
      continue
    }

    const otherClass = t(otherRow.ITEM_CLASS)
    const isIncome = otherClass === '收入' || otherClass === '業外收入'
    const isExpense = otherClass === '支出' || otherClass === '業外支出'
    const type = isIncome ? 'income' : (isExpense ? 'expense' : null)

    if (!type) {
      skipped += 2
      errors.push({
        id: `err-${groupKey}`,
        make_no, account_id,
        date: dateRaw,
        type: 'UNKNOWN_CLASS',
        severity: 'error',
        title: `非收支分錄類別（"${otherClass}"）`,
        description: `項目「${t(otherRow.ITEM_NOTE)}」之類別「${otherClass}」非標準收入或支出，無法自動入帳。`,
        suggested_fix: `請檢查該科目設定是否正確。`,
        raw_rows: formatRows(rows),
      })
      continue
    }

    const amount = Math.abs(assetRow.IN_MOUNT) || Math.abs(assetRow.OUT_MOUNT) || Math.abs(otherRow.IN_MOUNT) || Math.abs(otherRow.OUT_MOUNT)
    if (!amount) {
      skipped += 2
      errors.push({
        id: `err-${groupKey}`,
        make_no, account_id,
        date: dateRaw,
        type: 'ZERO_AMOUNT',
        severity: 'error',
        title: `收支金額為 0`,
        description: `項目「${t(otherRow.ITEM_NOTE)}」金額為 0，已略過匯入。`,
        suggested_fix: `若此筆為有效收支，請於 Zero.Net 補上金額。`,
        raw_rows: formatRows(rows),
      })
      continue
    }

    const accountName = t(assetRow.ITEM_NOTE)
    const category = t(otherRow.ITEM_NOTE)
    accountNames.add(accountName)
    if (type === 'income') totalIncome += amount; else totalExpense += amount

    transactions.push({
      type, date, amount,
      category, category_parent: parentMap.get(`${otherClass}|${category}`) ?? '',
      description: t(otherRow.DATA_NOTE) || t(assetRow.DATA_NOTE),
      notes: t(otherRow.DATA_NOTE2) || t(assetRow.DATA_NOTE2),
      pay_coll_name: t(otherRow.PAY_COLL_NAME) || t(assetRow.PAY_COLL_NAME),
      invoice_no: t(otherRow.INVOICE_NO) || t(assetRow.INVOICE_NO),
      account_name: accountName,
      external_ref: t(assetRow.DATA_KEY),
    })
  }

  const errorCount = errors.filter(e => e.severity === 'error').length
  const warningCount = errors.filter(e => e.severity === 'warning').length

  return {
    bookName,
    subjects,
    transactions, skipped,
    accountNames: [...accountNames].sort(),
    dateRange: minDate ? [minDate, maxDate] : null,
    totalIncome, totalExpense,
    bookCount: books.size,
    dateWarnings,
    errors,
    errorCount,
    warningCount,
  }
}
