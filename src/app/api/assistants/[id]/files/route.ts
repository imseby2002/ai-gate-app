import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/json': 'json',
  'text/plain': 'txt',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: assistantId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify assistant belongs to user
  const { data: assistant } = await supabase
    .from('assistants')
    .select('id')
    .eq('id', assistantId)
    .eq('user_id', user.id)
    .single()

  if (!assistant) return NextResponse.json({ error: 'Assistant not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const fileType = ALLOWED_TYPES[file.type]
  if (!fileType) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 })
  }

  // Upload to Supabase Storage
  const storagePath = `${user.id}/${assistantId}/${Date.now()}_${file.name}`
  const arrayBuffer = await file.arrayBuffer()
  const fileBuffer = new Uint8Array(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('assistant-files')
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Create DB record
  const { data: fileRecord, error: dbError } = await supabase
    .from('assistant_files')
    .insert({
      assistant_id: assistantId,
      user_id: user.id,
      file_name: file.name,
      file_type: fileType,
      storage_path: storagePath,
      file_size_bytes: file.size,
      processing_status: 'pending',
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Trigger async text extraction
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/files/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId: fileRecord.id }),
  }).catch(() => {}) // Non-blocking

  return NextResponse.json({ file: fileRecord })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: assistantId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get('fileId')
  if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })

  const { data: file } = await supabase
    .from('assistant_files')
    .select('storage_path')
    .eq('id', fileId)
    .eq('user_id', user.id)
    .single()

  if (file) {
    await supabase.storage.from('assistant-files').remove([file.storage_path])
  }

  await supabase.from('assistant_files').delete().eq('id', fileId).eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
