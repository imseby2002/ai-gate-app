// 檔案文字擷取（純 JS 套件：mammoth、xlsx、pdf-parse；.doc 用 xlsx 內附的 CFB 讀取器）。
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
  // Node 版 mammoth 只認得 { path } / { buffer } / { file }，傳 { arrayBuffer } 會 reject「Could not find file in options」
  const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) })
  return result.value
}

/**
 * Word 97-2003（.doc）：讀 OLE 容器的 WordDocument / Table 串流，依 piece table 取出正文。
 * 副檔名是 .doc 但內容其實是 docx / RTF / HTML 的檔案也一併處理。
 */
export async function extractDoc(arrayBuffer: ArrayBuffer): Promise<string> {
  const buf = Buffer.from(arrayBuffer)
  if (buf.subarray(0, 2).toString('latin1') === 'PK') return extractDocx(arrayBuffer)
  const head = buf.subarray(0, 512).toString('latin1').trimStart().toLowerCase()
  if (head.startsWith('{\\rtf')) return rtfToText(buf.toString('latin1'))
  if (head.startsWith('<') || head.includes('<html')) return htmlToText(new TextDecoder('utf-8').decode(buf))

  type Cfb = { read: (d: Buffer, o: { type: string }) => unknown; find: (c: unknown, p: string) => { content?: Uint8Array } | null }
  const mod = await import('xlsx') as unknown as { CFB?: Cfb; default?: { CFB?: Cfb } }
  const CFB = mod.CFB ?? mod.default?.CFB
  if (!CFB) throw new Error('CFB reader unavailable')
  const cfb = CFB.read(buf, { type: 'buffer' })
  const stream = (name: string) => { const e = CFB.find(cfb, name); return e?.content ? Buffer.from(e.content) : null }
  const wd = stream('WordDocument')
  if (!wd || wd.readUInt16LE(0) !== 0xA5EC) throw new Error('not a Word 97-2003 document')
  const flags = wd.readUInt16LE(0x0A)
  if (flags & 0x0100) throw new Error('encrypted document')
  const table = stream(flags & 0x0200 ? '1Table' : '0Table')
  if (!table) throw new Error('table stream missing')

  // FIB：fibBase(32) → csw + fibRgW → cslw + fibRgLw → cbRgFcLcb + fibRgFcLcb
  let off = 32
  const csw = wd.readUInt16LE(off); off += 2 + csw * 2
  const cslw = wd.readUInt16LE(off); const rgLw = off + 2; off += 2 + cslw * 4
  off += 2
  const ccpText = wd.readInt32LE(rgLw + 12)
  const fcClx = wd.readUInt32LE(off + 33 * 8), lcbClx = wd.readUInt32LE(off + 33 * 8 + 4)

  // CLX：略過 Prc（0x01），找到 Pcdt（0x02）
  let p = fcClx
  const end = fcClx + lcbClx
  while (p < end && table[p] === 0x01) p += 3 + table.readInt16LE(p + 1)
  if (table[p] !== 0x02) throw new Error('piece table missing')
  const lcb = table.readUInt32LE(p + 1); const plc = p + 5
  const n = Math.floor((lcb - 4) / 12)
  const cp1252 = new TextDecoder('windows-1252')
  let out = ''
  for (let i = 0; i < n; i++) {
    const cpStart = table.readUInt32LE(plc + i * 4), cpEnd = table.readUInt32LE(plc + (i + 1) * 4)
    if (cpStart >= ccpText) break
    const len = Math.min(cpEnd, ccpText) - cpStart
    const fcRaw = table.readUInt32LE(plc + (n + 1) * 4 + i * 8 + 2)
    const compressed = (fcRaw & 0x40000000) !== 0
    const fc = fcRaw & 0x3FFFFFFF
    out += compressed
      ? cp1252.decode(wd.subarray(fc / 2, fc / 2 + len))
      : wd.subarray(fc, fc + len * 2).toString('utf16le')
  }
  return cleanWordText(out)
}

function cleanWordText(s: string): string {
  // 欄位代碼 \x13 指令 \x14 結果 \x15 → 只留結果
  let prev = ''
  while (prev !== s) { prev = s; s = s.replace(/\x13[^\x13\x14\x15]*\x14([^\x13\x15]*)\x15/g, '$1').replace(/\x13[^\x13\x14\x15]*\x15/g, '') }
  return s
    .replace(/\x07\x07/g, '\n').replace(/\x07/g, '\t')
    .replace(/[\r\x0b\x0c]/g, '\n')
    .replace(/[\x00-\x08\x0e-\x1f]/g, '')
    .replace(/\t+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
}

function htmlToText(html: string): string {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n')
}

const RTF_SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'listtable', 'listoverridetable', 'rsidtbl', 'generator',
  'xmlnstbl', 'themedata', 'colorschememapping', 'latentstyles', 'datastore', 'filetbl', 'revtbl', 'object', 'header', 'footer',
  'headerl', 'headerr', 'headerf', 'footerl', 'footerr', 'footerf', 'fldinst', 'pgdsctbl', 'mmathPr', 'wgrffmtfilter'])

/** 簡易 RTF 轉文字：略過字型表等控制群組，\'hh 依 \ansicpg 碼頁解碼，\uN 為 Unicode */
function rtfToText(rtf: string): string {
  const cpMatch = rtf.match(/\\ansicpg(\d+)/)
  let decoder: TextDecoder
  try { decoder = new TextDecoder(cpMatch ? `windows-${cpMatch[1]}`.replace('windows-936', 'gbk').replace('windows-950', 'big5') : 'windows-1252') } catch { decoder = new TextDecoder('windows-1252') }
  const stack: { skip: boolean; uc: number }[] = []
  let skip = false, uc = 1, out = '', bytes: number[] = [], pendingSkip = 0
  const flush = () => { if (bytes.length) { out += decoder.decode(new Uint8Array(bytes)); bytes = [] } }
  const emit = (t: string) => { if (!skip) { flush(); out += t } }
  for (let i = 0; i < rtf.length; i++) {
    const c = rtf[i]
    if (c === '{') { stack.push({ skip, uc }); continue }
    if (c === '}') { flush(); const st = stack.pop(); if (st) { skip = st.skip; uc = st.uc } continue }
    if (c === '\\') {
      const n = rtf[i + 1]
      if (n === "'") { const b = parseInt(rtf.substr(i + 2, 2), 16); i += 3; if (pendingSkip > 0) { pendingSkip--; continue } if (!skip && !isNaN(b)) bytes.push(b); continue }
      if (n === '*') { skip = true; i++; continue }
      if (n === '\\' || n === '{' || n === '}') { emit(n); i++; continue }
      if (n === '~') { emit(' '); i++; continue }
      if (n === '\n' || n === '\r') { emit('\n'); i++; continue }
      const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i + 1, i + 40))
      if (!m) { i++; continue }
      i += m[0].length
      const word = m[1], arg = m[2] !== undefined ? Number(m[2]) : null
      if (RTF_SKIP.has(word)) skip = true
      else if (word === 'uc' && arg != null) uc = arg
      else if (word === 'u' && arg != null) { emit(String.fromCharCode(arg < 0 ? arg + 65536 : arg)); pendingSkip = uc }
      else if (word === 'par' || word === 'line' || word === 'row' || word === 'sect' || word === 'page') emit('\n')
      else if (word === 'tab' || word === 'cell') emit('\t')
      continue
    }
    if (c === '\r' || c === '\n') continue
    if (pendingSkip > 0) { pendingSkip--; continue }
    if (!skip) { flush(); out += c }
  }
  flush()
  return out.replace(/\t+\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
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

const TEXT_EXTS = ['txt', 'md', 'markdown', 'json', 'html', 'htm']

export function isSupportedKnowledgeFile(fileName: string): boolean {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  return ['pdf', 'doc', 'docx', 'xlsx', 'xls', 'csv', ...TEXT_EXTS].includes(ext)
}

/** 依副檔名擷取文字；不支援的格式回傳 null */
export async function extractFileText(fileName: string, arrayBuffer: ArrayBuffer): Promise<string | null> {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return extractPdf(arrayBuffer)
  if (ext === 'docx') return extractDocx(arrayBuffer)
  if (ext === 'doc') return extractDoc(arrayBuffer)
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return ext === 'csv' ? new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer)) : extractXlsx(arrayBuffer)
  if (TEXT_EXTS.includes(ext)) return new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer))
  return null
}
