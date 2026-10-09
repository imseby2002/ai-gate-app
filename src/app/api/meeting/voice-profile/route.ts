import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { language = 'vi-VN', fixed_text = '', audio_url = '' } = body

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('employee_voice_profiles')
      .upsert({
        user_id: user.id,
        language,
        fixed_text,
        audio_url,
        status: 'enrolled',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select('*')
      .single()

    if (error) {
      console.error('[VoiceProfile] upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, voiceProfile: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
