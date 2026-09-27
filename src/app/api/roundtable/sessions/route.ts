import { createClient } from '@/lib/supabase/server'
import { getModuleEntitlements } from '@/lib/module-plans/entitlements'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // 會議紀錄可查看筆數依方案（MAX 全部；其他最近 20 筆）
  const { features } = await getModuleEntitlements(user.id, 'roundtable')
  const { data, error } = await supabase
    .from('roundtable_sessions')
    .select('id, instruction, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(features.historyLimit === Infinity ? 1000 : features.historyLimit)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return Response.json({ sessions: data })
}
