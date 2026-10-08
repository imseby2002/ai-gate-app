import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getLocalizedDepartments } from '@/lib/org-units'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const locale = req.nextUrl.searchParams.get('locale') || 'zh-TW'

    // 1. 取得登入者資訊與所屬部門
    let profile: { id?: string; full_name?: string; units?: string[]; department?: string } | null = null
    try {
      const res = await supabase
        .from('profiles')
        .select('id, full_name, units, department')
        .eq('id', user.id)
        .maybeSingle()
      profile = res.data
    } catch (e) {
      console.warn('[Meeting Meta] Failed to get profile:', e)
    }

    // 2. 取得門市主檔（供下拉選單快速選取）
    let stores: Array<{ id: string; code: string; name?: string; short_name?: string; active?: boolean }> = []
    try {
      const res = await supabase
        .from('fin_stores')
        .select('id, code, name, short_name, active')
        .eq('active', true)
        .order('code')
      stores = res.data || []
    } catch (e) {
      console.warn('[Meeting Meta] Failed to get stores:', e)
    }

    const departments = getLocalizedDepartments(locale)

    return NextResponse.json({
      user: {
        id: user.id,
        name: profile?.full_name || user.email || 'User',
        units: profile?.units || [],
        department: profile?.department || (profile?.units?.[0] ?? ''),
      },
      departments,
      stores: stores.map(s => ({
        id: s.id,
        code: s.code,
        name: s.name || s.short_name || s.code,
        short_name: s.short_name || s.name || s.code,
      })),
    })
  } catch (err: unknown) {
    console.error('[Meeting Meta] exception:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
