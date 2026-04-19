import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

// Public endpoint: check if an email is in the employee whitelist
export async function POST(request: NextRequest) {
  const { email } = await request.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ whitelisted: false })
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('employee_whitelist')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  return NextResponse.json({ whitelisted: !!data })
}
