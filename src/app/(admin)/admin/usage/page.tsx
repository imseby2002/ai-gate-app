import { AdminUsageDashboard } from '@/components/admin/AdminUsageDashboard'

export const metadata = {
  title: '平台 AI Token 使用量與成本分析 | 管理後台',
  description: '總管理專屬：全模型成本監控、FreeLLM 與 CLIProxy 免費代理效益與商業直連費用分析',
}

export default function AdminUsagePage() {
  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-background px-4 sm:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        <AdminUsageDashboard />
      </div>
    </div>
  )
}
