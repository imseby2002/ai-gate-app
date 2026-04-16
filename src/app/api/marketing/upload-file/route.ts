/**
 * POST /api/marketing/upload-file
 * 上傳行銷素材至 Supabase Storage，並對文件類型做文字萃取
 *
 * Form fields:
 *   file     — 檔案
 *   category — 'logo' | 'image' | 'document' | 'faq'
 *
 * Response: {
 *   url: string
 *   name: string
 *   category: string
 *   mimeType: string
 *   sizeKb: number
 *   textContent?: string   // .docx / .xlsx / .txt / .pdf 才有
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

// ── Text extraction helpers ────────────────────────────────────────────────────

async function extractDocx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value ?? ''
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx')
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const lines: string[] = []
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    lines.push(`=== ${sheetName} ===\n${csv}`)
  }
  return lines.join('\n\n')
}

async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    return data.text ?? ''
  } catch {
    return ''
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const category = (form.get('category') as string) || 'document'

  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const storagePath = `${user.id}/${safeName}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('marketing-assets')
    .upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('marketing-assets')
    .getPublicUrl(storagePath)

  // Extract text content for document types
  let textContent: string | undefined
  try {
    if (ext === 'docx') {
      textContent = await extractDocx(buffer)
    } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      textContent = await extractXlsx(buffer)
    } else if (ext === 'pdf') {
      textContent = await extractPdf(buffer)
    } else if (ext === 'txt') {
      textContent = buffer.toString('utf-8')
    }
  } catch {
    // text extraction is best-effort
  }

  return NextResponse.json({
    url: urlData.publicUrl,
    name: file.name,
    category,
    mimeType: file.type,
    sizeKb: Math.round(buffer.byteLength / 1024),
    ...(textContent ? { textContent: textContent.slice(0, 50000) } : {}),
  })
}
