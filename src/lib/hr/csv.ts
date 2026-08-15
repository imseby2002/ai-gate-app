// 極簡 CSV 工具（不裝任何套件）：解析、產生範本、觸發下載。
// 支援引號包住的欄位、欄內逗號/換行、"" 跳脫，以及 Excel 的 BOM。

export function parseCsv(text: string): string[][] {
  let s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1) // 去除 BOM

  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += c
      }
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else field += c
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }

  // 丟掉整列皆空白的列
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

// 需要引號的欄位（含逗號、引號或換行）加引號並跳脫
function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(csvCell).join(',')]
  for (const r of rows) lines.push(r.map(csvCell).join(','))
  return '﻿' + lines.join('\n') // BOM 讓 Excel 正確辨識 UTF-8
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
