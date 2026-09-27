import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { allowedCoverLetterTemplateIds } from '@/lib/resume/billing'

// GET active templates — available to all authenticated users
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('cover_letter_templates')
    .select('id, name, description, category')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // 方案外的模板標示 locked（職場助手 MAX 才可用全部模板）
  const allowed = await allowedCoverLetterTemplateIds(supabase, user.id)
  return NextResponse.json((data ?? []).map(t => ({ ...t, locked: allowed ? !allowed.has(t.id) : false })))
}
