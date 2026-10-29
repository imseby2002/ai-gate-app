import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GUEST_HEADER, verifyGuestToken } from '@/lib/meeting/access'

// 登入成員，或持有效訪客 token（會議進行中且允許訪客）的人可取得語音辨識 token
async function allowed(req: NextRequest): Promise<boolean> {
  const guest = verifyGuestToken(req.headers.get(GUEST_HEADER))
  if (guest) {
    const { data: m } = await createAdminClient().from('meetings').select('is_active, allow_guests').eq('id', guest.m).maybeSingle()
    return !!(m?.is_active && m?.allow_guests)
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return !!user
}

export async function GET(req: NextRequest) {
  if (!(await allowed(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION || 'southeastasia'

  if (!key) {
    return NextResponse.json({
      configured: false,
      message: 'AZURE_SPEECH_KEY not set, falling back to Web Speech API',
    })
  }

  try {
    const res = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': '0',
      },
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[azure-token] failed to issue token:', res.status, errText)
      return NextResponse.json({
        configured: false,
        error: `Azure Speech STS returned status ${res.status}: ${errText}`,
      }, { status: 502 })
    }

    const token = await res.text()
    return NextResponse.json({
      configured: true,
      token,
      region,
      expiresIn: 600, // 10 minutes
    })
  } catch (err: unknown) {
    console.error('[azure-token] network exception:', err)
    return NextResponse.json({
      configured: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
