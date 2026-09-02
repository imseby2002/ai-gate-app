import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CompanyManagement } from '@/components/admin/CompanyManagement'

export const dynamic = 'force-dynamic'

export default async function AdminCompaniesPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  // 取得所有公司、成員與全體用戶清單
  const [
    { data: companies },
    { data: members },
    { data: profiles },
  ] = await Promise.all([
    admin.from('companies').select('*').order('created_at', { ascending: false }),
    admin.from('company_members').select('*').order('created_at', { ascending: true }),
    admin.from('profiles').select('id, email, full_name, user_type, company_id').order('created_at', { ascending: false }),
  ])

  const profMap = new Map((profiles ?? []).map(p => [p.id, p]))

  // 彙整每間公司的成員
  const membersByCompany = new Map<string, any[]>()
  for (const m of members ?? []) {
    const list = membersByCompany.get(m.company_id) ?? []
    list.push({
      ...m,
      profile: m.member_id ? profMap.get(m.member_id) ?? null : null,
    })
    membersByCompany.set(m.company_id, list)
  }

  const initialCompanies = (companies ?? []).map(c => {
    const compMembers = membersByCompany.get(c.id) ?? []
    const ownerMember = compMembers.find(m => m.role === 'owner' && m.status === 'active')
    const itMember = compMembers.find(m => m.role === 'admin' && m.status === 'active')
    const creatorProfile = profMap.get(c.created_by) ?? null
    return {
      ...c,
      creator: creatorProfile,
      owner: ownerMember?.profile ?? null,
      it: itMember?.profile ?? null,
      memberCount: compMembers.filter(m => m.status === 'active').length,
      pendingCount: compMembers.filter(m => m.status === 'pending').length,
      members: compMembers,
    }
  })

  return (
    <div className="px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">公司實體與成員管理</h1>
        <p className="text-gray-500 text-sm mt-1">
          建置獨立公司實體，管理各公司旗下使用者、權限角色與開通模組
        </p>
      </div>

      <CompanyManagement
        initialCompanies={initialCompanies}
        allUsers={profiles ?? []}
      />
    </div>
  )
}
