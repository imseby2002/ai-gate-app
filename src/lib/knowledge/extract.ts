// 檔案文字擷取（純 JS 套件：mammoth、xlsx、pdf-parse）。
// 供助理檔案解析（/api/files/parse）與公司知識庫上傳共用。

export async function extractXlsx(arrayBuffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  return workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name]
    return `## Sheet: ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`
  }).join('\n\n')
}

export async function extractDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

export async function extractPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const pdfParse = await import('pdf-parse')
    const parse = (pdfParse as unknown as { default: (b: Uint8Array) => Promise<{ text: string }> }).default ?? pdfParse
    const result = await (parse as (b: Uint8Array) => Promise<{ text: string }>)(new Uint8Array(arrayBuffer))
    return result.text
  } catch {
    return '[PDF 文字擷取失敗，請在對話中使用視覺模型分析此 PDF]'
  }
}

/** 依副檔名擷取文字；不支援的格式回傳 null */
export async function extractFileText(fileName: string, arrayBuffer: ArrayBuffer): Promise<string | null> {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return extractPdf(arrayBuffer)
  if (ext === 'docx') return extractDocx(arrayBuffer)
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return ext === 'csv' ? new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer)) : extractXlsx(arrayBuffer)
  if (['txt', 'md', 'markdown', 'json', 'html', 'htm'].includes(ext)) return new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer))
  return null
}
