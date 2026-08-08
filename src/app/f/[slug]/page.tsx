import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import type { CsFormField } from '@/app/api/marketing/cs-forms/route'
import { isFormAvailableToday } from '@/lib/cs/formSchedule'
import FormClient from './FormClient'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data } = await admin
    .from('cs_forms')
    .select('id, name, fields, enabled, available_weekdays')
    .eq('slug', slug)
    .single()

  if (!data || !data.enabled) notFound()

  if (!isFormAvailableToday(data.available_weekdays)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mb-3 text-3xl">📅</div>
          <h1 className="mb-2 text-lg font-semibold text-gray-900">今天不開放填寫</h1>
          <p className="text-sm text-gray-500">這份表單今天暫不開放，請改天再來或聯繫我們。</p>
        </div>
      </div>
    )
  }

  return (
    <FormClient
      slug={slug}
      name={data.name}
      fields={(data.fields as CsFormField[]) ?? []}
    />
  )
}
