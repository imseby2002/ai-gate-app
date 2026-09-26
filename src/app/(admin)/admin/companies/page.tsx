import { createAdminClient } from '@/lib/supabase/admin'
import { CompanyManagement } from '@/components/admin/CompanyManagement'
import { loadAdminCompanyList } from '@/lib/company/admin-list'

export const dynamic = 'force-dynamic'

export default async function AdminCompaniesPage() {
  const admin = createAdminClient()

  // 公司列表與 GET /api/admin/companies 共用同一份資料（含方案、企業版設定），
  // 重新整理後對話框才會顯示正確方案
  const [initialCompanies, { data: profiles }] = await Promise.all([
    loadAdminCompanyList(),
    admin.from('profiles').select('id, email, full_name, user_type, company_id').order('created_at', { ascending: false }),
  ])

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
