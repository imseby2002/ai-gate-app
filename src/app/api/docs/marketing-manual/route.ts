// 行銷部門系統使用說明書（PDF）。內含系統截圖，僅限登入者讀取；?download=1 直接下載。
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FILE = path.join(process.cwd(), 'docs', 'marketing-manual.pdf')
const NAME = '行銷部門系統使用說明書.pdf'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pdf = await readFile(FILE)
  const disposition = req.nextUrl.searchParams.get('download') ? 'attachment' : 'inline'
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="marketing-manual.pdf"; filename*=UTF-8''${encodeURIComponent(NAME)}`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
