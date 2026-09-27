import { MarketingPlansTable } from './MarketingPlansTable'

export default function AdminMarketingPlansPage() {
  return (
    <div className="px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">行銷方案管理</h1>
        <p className="text-gray-500 text-sm mt-1">手動設定帳號的行銷模組方案（銀行轉帳、優惠贈送等場合使用）。內部帳號（管理者／員工）一律視同 MAX；所屬公司開通行銷模組（公司版／專屬客製-企業版）時，「實際生效」一律為 MAX，與帳號自訂方案取較高者。</p>
      </div>
      <MarketingPlansTable />
    </div>
  )
}
