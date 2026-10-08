import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
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
