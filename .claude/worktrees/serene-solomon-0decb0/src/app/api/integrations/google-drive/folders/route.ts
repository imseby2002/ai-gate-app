import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidAccessToken } from '@/lib/drive-token'
import { listFolders } from '@/lib/google-drive'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = await getValidAccessToken(user.id)
  if (!token) return NextResponse.json({ error: 'Google Drive not connected' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const parentId = searchParams.get('parentId') ?? 'root'

  const folders = await listFolders(token, parentId)
  return NextResponse.json({ folders })
}
