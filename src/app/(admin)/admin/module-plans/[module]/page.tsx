import { notFound } from 'next/navigation'
import { PLAN_MODULES, MODULE_PLANS, MODULE_PLAN_LABEL, MODULE_PLAN_SUMMARY, isPlanModule } from '@/lib/module-plans/definitions'
import { ModulePlansTable } from './ModulePlansTable'

export default async function AdminModulePlansPage({ params }: { params: Promise<{ module: string }> }) {
  const { module: moduleId } = await params
  if (!isPlanModule(moduleId)) notFound()
  const label = PLAN_MODULES.find(m => m.id === moduleId)!.label

  return (
    <div className="px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{label}方案管理</h1>
        <p className="text-gray-500 text-sm mt-1">手動設定帳號的{label}方案（銀行轉帳、優惠贈送等場合使用）。內部帳號（管理者／員工）一律視同 MAX。公司成員隨公司：專屬客製-企業版或公司版開通此模組為 MAX，否則 FREE，不可個別設定。外部個人帳號預設 FREE。方案只控制功能與上限，點數照舊扣。</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {MODULE_PLANS.map(p => (
          <div key={p} className="border rounded-xl px-4 py-3 bg-white">
            <div className="text-xs font-semibold text-indigo-600">{MODULE_PLAN_LABEL[p]}</div>
            <div className="text-xs text-gray-600 mt-1">{MODULE_PLAN_SUMMARY[moduleId][p]}</div>
          </div>
        ))}
      </div>
      <ModulePlansTable moduleId={moduleId} />
    </div>
  )
}
