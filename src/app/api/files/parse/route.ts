import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { fileId } = body as { fileId: string }
  if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })

  const supabase = await createAdminClient()

  // Get file record
  const { data: file } = await supabase
    .from('assistant_files')
    .select('*')
    .eq('id', fileId)
    .single()

  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  // Mark as processing
  await supabase
    .from('assistant_files')
    .update({ processing_status: 'processing' })
    .eq('id', fileId)

  try {
    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('assistant-files')
      .download(file.storage_path)

    if (downloadError || !fileData) throw new Error('Download failed')

    const buffer = Buffer.from(await fileData.arrayBuffer())
    let extractedText = ''

    if (file.file_type === 'pdf') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const result = await pdfParse(buffer)
      extractedText = result.text
    } else if (file.file_type === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value
    } else if (file.file_type === 'xlsx') {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheets = workbook.SheetNames.map(name => {
        const sheet = workbook.Sheets[name]
        return `## Sheet: ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`
      })
      extractedText = sheets.join('\n\n')
    } else if (file.file_type === 'json') {
      extractedText = buffer.toString('utf-8')
      try {
        const parsed = JSON.parse(extractedText)
        extractedText = JSON.stringify(parsed, null, 2)
      } catch {}
    } else if (file.file_type === 'txt') {
      extractedText = buffer.toString('utf-8')
    } else if (['jpg', 'jpeg', 'png'].includes(file.file_type)) {
      // For images, store a placeholder - actual OCR handled by vision model in chat
      extractedText = `[圖片檔案：${file.file_name}，請在對話中使用視覺模型分析]`
    }

    await supabase
      .from('assistant_files')
      .update({
        extracted_text: extractedText.slice(0, 500_000), // 500K char limit
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
