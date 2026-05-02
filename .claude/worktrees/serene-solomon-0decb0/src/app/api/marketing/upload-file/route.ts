/**
 * POST /api/marketing/upload-file
 * 上傳行銷素材至 Supabase Storage，並對文件類型做文字萃取
 * Edge Runtime — mammoth/xlsx/pdf-parse 均為純 JS，透過 nodejs_compat 支援
 *
 * Form fields:
 *   file     — 檔案
 *   category — 'logo' | 'image' | 'document' | 'faq'
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Text extraction (pure-JS, nodejs_compat) ────────────────────────────────

async function extractDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value ?? ''
}

async function extractXlsx(arrayBuffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const lines: string[] = []
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    lines.push(`=== ${sheetName} ===\n${XLSX.utils.sheet_to_csv(sheet)}`)
  }
  return lines.join('\n\n')
}

async function extractPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const pdfParse = await import('pdf-parse')
    const parse = (pdfParse as unknown as { default: (b: Uint8Array) => Promise<{ text: string }> }).default ?? pdfParse
    const result = await (parse as (b: Uint8Array) => Promise<{ text: string }>)(new Uint8Array(arrayBuffer))
    return result.text ?? ''
  } catch {
    return ''
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const category = (form.get('category') as string) || 'document'

  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const storagePath = `${user.id}/${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('marketing-assets')
    .upload(storagePath, uint8, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage
    .from('marketing-assets')
    .getPublicUrl(storagePath)

  let textContent: string | undefined
  try {
    if (ext === 'docx') {
      textContent = await extractDocx(arrayBuffer)
    } else if (ext === 'xlsx' || ext === 'xls') {
      textContent = await extractXlsx(arrayBuffer)
    } else if (ext === 'csv' || ext === 'txt') {
      textContent = new TextDecoder('utf-8').decode(uint8)
    } else if (ext === 'pdf') {
      textContent = await extractPdf(arrayBuffer)
    }
  } catch {
    // text extraction is best-effort
  }

  return NextResponse.json({
    url: urlData.publicUrl,
    name: file.name,
    category,
    mimeType: file.type,
    sizeKb: Math.round(arrayBuffer.byteLength / 1024),
    ...(textContent ? { textContent: textContent.slice(0, 50000) } : {}),
  })
}
