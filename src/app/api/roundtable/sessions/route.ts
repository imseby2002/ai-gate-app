import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { data, error } = await supabase
    .from('roundtable_sessions')
    .select('id, instruction, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return Response.json({ sessions: data })
}
