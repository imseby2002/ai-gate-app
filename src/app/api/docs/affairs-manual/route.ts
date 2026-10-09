import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 外務系統使用說明書：依 ?lang= 或 locale cookie 選語言版本，預設繁中
const FILES: Record<string, { file: string; name: string }> = {
  'zh-TW': { file: 'affairs-manual.pdf', name: '外務系統使用說明書.pdf' },
  en: { file: 'affairs-manual.en.pdf', name: 'Affairs System User Manual.pdf' },
  vi: { file: 'affairs-manual.vi.pdf', name: 'Huong dan su dung he thong Tong vu.pdf' },
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lang = req.nextUrl.searchParams.get('lang') ?? req.cookies.get('locale')?.value ?? 'zh-TW'
  const { file, name } = FILES[lang] ?? FILES['zh-TW']
  const pdf = await readFile(path.join(process.cwd(), 'docs', file))
  const disposition = req.nextUrl.searchParams.get('download') ? 'attachment' : 'inline'
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${file}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, max-age=3600',
      Vary: 'Cookie',
    },
  })
}
