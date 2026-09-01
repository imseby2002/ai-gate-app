import * as XLSX from 'xlsx'

export interface ImportColumn {
  key: string
  label: string
  aliases?: string[]
  required?: boolean
  example?: string | number | boolean
  description?: string
  transform?: (val: unknown, row: Record<string, unknown>) => unknown
}

export interface ParseResult {
  rows: Record<string, unknown>[]
  totalRawRows: number
  headers: string[]
  errors: { line: number; message: string }[]
}

/**
 * Parses date cell value which could be an Excel serial number, Date object, or date string.
 * Returns 'YYYY-MM-DD' formatted string or original trimmed string.
 */
export function normalizeDate(val: unknown): string {
  if (val === null || val === undefined || val === '') return ''
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10)
  }
  if (typeof val === 'number') {
    // Excel base date 1899-12-30
    const date = new Date(Math.round((val - 25569) * 86400 * 1000))
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10)
    }
  }
  const s = String(val).trim()
  // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  const m1 = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m1) {
    return `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`
  }
  // DD/MM/YYYY
  const m2 = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (m2) {
    return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`
  }
  return s
}

/**
 * Normalizes number value by stripping currency symbols, commas, spaces.
 */
export function normalizeNumber(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback
  if (typeof val === 'number') return isNaN(val) ? fallback : val
  const s = String(val).replace(/[$NTNT$¥₫,\s]/gi, '').trim()
  const n = Number(s)
  return isNaN(n) ? fallback : n
}

/**
 * Normalizes boolean value (e.g. 是/否, true/false, 1/0, Y/N).
 */
export function normalizeBoolean(val: unknown, fallback = false): boolean {
  if (val === null || val === undefined || val === '') return fallback
  if (typeof val === 'boolean') return val
  const s = String(val).trim().toLowerCase()
  if (['true', '1', '是', 'yes', 'y', 'v', 'ok', '啟用', '正本'].includes(s)) return true
  if (['false', '0', '否', 'no', 'n', 'x', '停用', '影本'].includes(s)) return false
  return fallback
}

/**
 * Parse an uploaded File (.xlsx, .xls, .csv) into structured objects based on column specs.
 */
export async function parseSpreadsheetFile(file: File, columns: ImportColumn[]): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
  
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('試算表檔案內沒有任何工作表')
  }

  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

  if (rawData.length < 2) {
    return { rows: [], totalRawRows: 0, headers: [], errors: [{ line: 1, message: '檔案中沒有資料列（至少需要標題列與一列資料）' }] }
  }

  const headerRow = (rawData[0] as unknown[]).map(h => String(h ?? '').trim())
  const errors: { line: number; message: string }[] = []
  
  // Build header mapping: columnIndex -> ImportColumn
  const colMapping = new Map<number, ImportColumn>()
  const missingRequiredColumns: string[] = []

  columns.forEach(col => {
    const candidates = [col.label, col.key, ...(col.aliases ?? [])].map(c => c.toLowerCase().trim())
    const idx = headerRow.findIndex(h => candidates.includes(h.toLowerCase()))
    if (idx >= 0) {
      colMapping.set(idx, col)
    } else if (col.required) {
      missingRequiredColumns.push(col.label)
    }
  })

  if (missingRequiredColumns.length > 0) {
    errors.push({
      line: 1,
      message: `缺少必要欄位標題：${missingRequiredColumns.join('、')}。請確認檔案欄位名稱或下載範本填寫。`,
    })
  }

  const resultRows: Record<string, unknown>[] = []

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r] as unknown[]
    // Skip totally empty rows
    const isRowEmpty = !row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')
    if (isRowEmpty) continue

    const rowObj: Record<string, unknown> = {}
    let hasAnyData = false

    // Initialize all columns
    columns.forEach(c => { rowObj[c.key] = '' })

    colMapping.forEach((col, idx) => {
      const rawVal = row[idx]
      let val: unknown = rawVal !== undefined && rawVal !== null ? (typeof rawVal === 'string' ? rawVal.trim() : rawVal) : ''
      if (col.transform) {
        val = col.transform(val, rowObj)
      }
      rowObj[col.key] = val
      if (val !== '' && val !== null && val !== undefined) {
        hasAnyData = true
      }
    })

    if (!hasAnyData) continue

    // Check required fields for this row
    const rowMissing = columns.filter(c => c.required && (rowObj[c.key] === '' || rowObj[c.key] === null || rowObj[c.key] === undefined))
    if (rowMissing.length > 0) {
      errors.push({
        line: r + 1,
        message: `第 ${r + 1} 列缺少必填項目：${rowMissing.map(c => c.label).join('、')}`,
      })
    }

    resultRows.push(rowObj)
  }

  return {
    rows: resultRows,
    totalRawRows: rawData.length - 1,
    headers: headerRow,
    errors,
  }
}

/**
 * Downloads an Excel (.xlsx) template pre-populated with headers and optional sample data.
 */
export function downloadExcelTemplate(filename: string, sheetName: string, columns: ImportColumn[]): void {
  const headers = columns.map(c => c.label)
  const exampleRow = columns.map(c => c.example !== undefined ? c.example : '')
  const descriptionRow = columns.map(c => c.required ? `(必填) ${c.description || ''}`.trim() : c.description || '')

  const data = [headers, exampleRow]
  if (descriptionRow.some(d => !!d)) {
    data.push(descriptionRow)
  }

  const ws = XLSX.utils.aoa_to_sheet(data)
  
  // Set reasonable column widths
  ws['!cols'] = columns.map(c => ({
    wch: Math.max(12, String(c.label).length * 3, String(c.example ?? '').length + 4),
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))

  const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(wb, cleanFilename)
}

/**
 * Downloads a CSV template pre-populated with headers and sample data.
 */
export function downloadCsvTemplate(filename: string, columns: ImportColumn[]): void {
  const headers = columns.map(c => `"${String(c.label).replace(/"/g, '""')}"`).join(',')
  const exampleRow = columns.map(c => `"${String(c.example ?? '').replace(/"/g, '""')}"`).join(',')
  const csvContent = '\uFEFF' + [headers, exampleRow].join('\r\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
