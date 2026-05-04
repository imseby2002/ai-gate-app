import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ModuleId } from './modules'

export async function requireModule(moduleId: ModuleId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('enabled_modules, user_type')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // admin can access everything
  if (profile.user_type === 'admin') return profile

  const enabled: string[] = profile.enabled_modules ?? ['chat', 'marketing', 'cs', 'leads', 'resume']
  if (!enabled.includes(moduleId)) redirect('/dashboard?blocked=' + moduleId)

  return profile
}
