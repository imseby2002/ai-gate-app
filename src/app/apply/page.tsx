// 公司子網域的公開應徵連結：<slug>.im-tourist.com/apply
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { companyFromHost } from '@/lib/company/fromHost'
import ApplyForm from './ApplyForm'

export const dynamic = 'force-dynamic'

export default async function CompanyApplyPage() {
  const company = await companyFromHost((await headers()).get('host') ?? '')
  if (!company) notFound()
  const admin = createAdminClient()
  const { data } = await admin.from('hr_settings').select('apply_code').eq('owner_id', company.ownerId).maybeSingle()
  if (!data?.apply_code) notFound()
  return <ApplyForm code={data.apply_code} />
}
