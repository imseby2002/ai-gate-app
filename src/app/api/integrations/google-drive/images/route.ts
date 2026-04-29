import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidAccessToken } from '@/lib/drive-token'
import { listImages } from '@/lib/google-drive'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const folderId = searchParams.get('folderId')
  if (!folderId) return NextResponse.json({ error: 'folderId required' }, { status: 400 })

  const token = await getValidAccessToken(user.id)
  if (!token) return NextResponse.json({ error: 'Google Drive not connected' }, { status: 403 })

  const images = await listImages(token, folderId)
  return NextResponse.json({ images })
}
