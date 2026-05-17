import { createClient } from '@supabase/supabase-js'

// Service-role client — no cookie/session required
// Only for server-side background jobs (cron, sync workers)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
