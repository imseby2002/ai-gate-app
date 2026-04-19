import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'edge'

// ─── Edge-compatible text extraction ─────────────────────────────────────────
// Cloudflare Workers with nodejs_compat supports pure-JS packages.
// mammoth and xlsx are pure JS (no native bindings) → work via nodejs_compat.
// pdf-parse requires Buffer which is available via nodejs_compat.

async function extractXlsx(arrayBuffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  return workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name]
    return `## Sheet: ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`
  }).join('\n\n')
}

async function extractDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

async function extractPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // pdf-parse is pure JS and works with nodejs_compat on Cloudflare Workers
    const pdfParse = await import('pdf-parse')
    const parse = (pdfParse as unknown as { default: (b: Uint8Array) => Promise<{ text: string }> }).default ?? pdfParse
    const result = await (parse as (b: Uint8Array) => Promise<{ text: string }>)(new Uint8Array(arrayBuffer))
    return result.text
  } catch {
    return '[PDF 文字擷取失敗，請在對話中使用視覺模型分析此 PDF]'
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { fileId } = body as { fileId: string }
  if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })

  const supabase = await createAdminClient()

  const { data: file } = await supabase
    .from('assistant_files')
    .select('*')
    .eq('id', fileId)
    .single()

  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  await supabase
    .from('assistant_files')
    .update({ processing_status: 'processing' })
    .eq('id', fileId)

  try {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('assistant-files')
      .download(file.storage_path)

    if (downloadError || !fileData) throw new Error('Download failed')

    const arrayBuffer = await fileData.arrayBuffer()
    const decoder = new TextDecoder('utf-8')
    let extractedText = ''

    if (file.file_type === 'pdf') {
      extractedText = await extractPdf(arrayBuffer)
    } else if (file.file_type === 'docx') {
      extractedText = await extractDocx(arrayBuffer)
    } else if (file.file_type === 'xlsx') {
      extractedText = await extractXlsx(arrayBuffer)
    } else if (file.file_type === 'json') {
      extractedText = decoder.decode(new Uint8Array(arrayBuffer))
      try {
        const parsed = JSON.parse(extractedText)
        extractedText = JSON.stringify(parsed, null, 2)
      } catch { /* keep raw */ }
    } else if (file.file_type === 'txt') {
      extractedText = decoder.decode(new Uint8Array(arrayBuffer))
    } else if (['jpg', 'jpeg', 'png'].includes(file.file_type)) {
      extractedText = `[圖片檔案：${file.file_name}，請在對話中使用視覺模型分析]`
    }

    await supabase
      .from('assistant_files')
      .update({
        extracted_text: extractedText.slice(0, 500_000),
        processing_status: 'done',
        chunk_count: Math.ceil(extractedText.length / 1000),
      })
      .eq('id', fileId)

    return NextResponse.json({ success: true, chars: extractedText.length })
  } catch (error) {
    await supabase
      .from('assistant_files')
      .update({ processing_status: 'failed' })
      .eq('id', fileId)

    console.error('File parse error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
