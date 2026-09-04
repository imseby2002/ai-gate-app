// 解析 Zero（帳務小管家）記帳軟體的 .mdb 資料庫，轉換成 hr_cashflow 可匯入的交易列。
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

export interface ZeroParseResult {
  transactions: ZeroTransaction[]
  skipped: number
  accountNames: string[]
  dateRange: [string, string] | null
  totalIncome: number
  totalExpense: number
  bookCount: number
  dateWarnings: number // 日期年份落在合理範圍外（原始資料本身的錯字/異常，如 1405、3240 年），仍會匯入但不計入 dateRange 摘要
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
}

const t = (v: unknown) => String(v ?? '').trim()

function parseZeroDate(raw: string): string | null {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(t(raw))
  if (!m) return null
  const [, y, mo, d] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export function parseZeroMdb(buffer: Buffer): ZeroParseResult {
  const reader = new MDBReader(buffer)
  const money = reader.getTable('MYMONEY_DATA').getData<MoneyRow>()
  const items = reader.getTable('ITEM_DATA').getData<ItemRow>()

  const parentMap = new Map<string, string>()
  for (const it of items) parentMap.set(`${t(it.ITEM_CLASS)}|${t(it.ITEM_NOTE)}`, t(it.PARENT_NOTE))

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
  let skipped = 0
  let minDate = '', maxDate = ''
  let totalIncome = 0, totalExpense = 0
  let dateWarnings = 0

  const PLAUSIBLE_YEAR_MIN = 2000
  const PLAUSIBLE_YEAR_MAX = new Date().getFullYear() + 1
  const trackDate = (date: string) => {
    const year = Number(date.slice(0, 4))
    if (year < PLAUSIBLE_YEAR_MIN || year > PLAUSIBLE_YEAR_MAX) { dateWarnings++; return }
    if (!minDate || date < minDate) minDate = date
    if (!maxDate || date > maxDate) maxDate = date
  }

  for (const rows of groups.values()) {
    if (rows.length !== 2) { skipped += rows.length; continue }
    const [a, b] = rows
    const date = parseZeroDate(a.DATA_DATE)
    if (!date) { skipped += 2; continue }

    const assetRow = t(a.ITEM_CLASS) === '資產' ? a : (t(b.ITEM_CLASS) === '資產' ? b : null)
    if (!assetRow) { skipped += 2; continue } // 極少數無資產列的異常分錄，不匯入
    const otherRow = assetRow === a ? b : a

    if (t(otherRow.ITEM_CLASS) === '資產') {
      // 帳戶間轉帳：一列轉出（OUT_MOUNT）、一列轉入（IN_MOUNT）
      const fromRow = a.OUT_MOUNT > 0 ? a : b
      const toRow = fromRow === a ? b : a
      const amount = Math.abs(fromRow.OUT_MOUNT) || Math.abs(toRow.IN_MOUNT)
      if (!amount) { skipped += 2; continue }
      trackDate(date)
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
    const type = otherClass === '收入' ? 'income' : otherClass === '支出' ? 'expense' : null
    if (!type) { skipped += 2; continue }
    const amount = Math.abs(assetRow.IN_MOUNT) || Math.abs(assetRow.OUT_MOUNT) || Math.abs(otherRow.IN_MOUNT) || Math.abs(otherRow.OUT_MOUNT)
    if (!amount) { skipped += 2; continue }

    const accountName = t(assetRow.ITEM_NOTE)
    const category = t(otherRow.ITEM_NOTE)
    trackDate(date)
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

  return {
    transactions, skipped,
    accountNames: [...accountNames].sort(),
    dateRange: minDate ? [minDate, maxDate] : null,
    totalIncome, totalExpense,
    bookCount: books.size,
    dateWarnings,
  }
}
