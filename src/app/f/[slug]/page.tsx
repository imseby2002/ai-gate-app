import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import type { CsFormField } from '@/app/api/marketing/cs-forms/route'
import FormClient from './FormClient'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data } = await admin
    .from('cs_forms')
    .select('id, name, fields, enabled')
    .eq('slug', slug)
    .single()

  if (!data || !data.enabled) notFound()

  return (
    <FormClient
      slug={slug}
      name={data.name}
      fields={(data.fields as CsFormField[]) ?? []}
    />
  )
}
