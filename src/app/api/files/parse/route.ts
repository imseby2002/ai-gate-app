import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { extractPdf, extractDocx, extractXlsx } from '@/lib/knowledge/extract'

// 文字擷取共用 src/lib/knowledge/extract.ts（mammoth、xlsx、pdf-parse 皆為純 JS）

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { fileId } = body as { fileId: string }
  if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })

  const supabase2 = await createAdminClient()

  const { data: file } = await supabase2
    .from('assistant_files')
    .select('*')
    .eq('id', fileId)
    .single()

  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  await supabase2
    .from('assistant_files')
    .update({ processing_status: 'processing' })
    .eq('id', fileId)

  try {
    const { data: fileData, error: downloadError } = await supabase2.storage
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

    await supabase2
      .from('assistant_files')
      .update({
        extracted_text: extractedText.slice(0, 500_000),
        processing_status: 'done',
        chunk_count: Math.ceil(extractedText.length / 1000),
      })
      .eq('id', fileId)

    return NextResponse.json({ success: true, chars: extractedText.length })
  } catch (error) {
    await supabase2
      .from('assistant_files')
      .update({ processing_status: 'failed' })
      .eq('id', fileId)

    console.error('File parse error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
