import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLocalizedDepartments } from '@/lib/org-units'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const locale = req.nextUrl.searchParams.get('locale') || 'zh-TW'
  const admin = createAdminClient()

  // 1. 取得登入者資訊與所屬部門
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, units, department')
    .eq('id', user.id)
    .maybeSingle()

  // 2. 取得門市主檔（供下拉選單快速選取並注入專有名詞保護）
  const { data: stores } = await admin
    .from('fin_stores')
    .select('id, code, name, short_name, active')
    .eq('active', true)
    .order('code')

  // 3. 取得員工自己的聲紋檔案狀態
  const { data: voiceProfile } = await admin
    .from('employee_voice_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const departments = getLocalizedDepartments(locale)

  const fixedSentences: Record<string, string> = {
    'zh-TW': '我是台灣極渴與 FEELING TEA 的夥伴，今天在門市與辦公室參與營運盤點與各部門會議，確認設備與物料品質。',
    'vi': 'Tôi là nhân viên của FEELING TEA, hôm nay tham gia cuộc họp vận hành và kiểm kê cửa hàng, xác nhận chất lượng thiết bị và nguyên vật liệu.',
    'en': 'I am a team member of FEELING TEA, participating in store operations, inventory checks, and cross-department meetings today.',
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: profile?.full_name || user.email || 'User',
      units: profile?.units || [],
      department: profile?.department || (profile?.units?.[0] ?? ''),
    },
    departments,
    stores: (stores ?? []).map(s => ({
      id: s.id,
      code: s.code,
      name: s.name || s.short_name || s.code,
      short_name: s.short_name || s.name || s.code,
    })),
    voiceProfile: voiceProfile ? {
      status: voiceProfile.status,
      language: voiceProfile.language,
      audio_url: voiceProfile.audio_url,
      updated_at: voiceProfile.updated_at,
    } : null,
    fixedSentences,
  })
}
