// 前端匯出 Excel（.xlsx）：多個工作表，每表第一列為表頭。xlsx 套件於用到時才載入。
export interface ExportSheet { name: string; rows: (string | number | null)[][]; widths?: number[] }

export async function downloadXlsx(filename: string, sheets: ExportSheet[]): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const sh of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sh.rows)
    ws['!cols'] = (sh.widths ?? (sh.rows[0] ?? []).map(h => Math.max(10, String(h ?? '').length * 2 + 2))).map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, sh.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1')
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}
