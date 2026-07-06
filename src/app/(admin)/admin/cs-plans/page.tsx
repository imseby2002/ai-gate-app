import { CsPlansTable } from './CsPlansTable'

export default function AdminCsPlansPage() {
  return (
    <div className="px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CS 方案管理</h1>
        <p className="text-gray-500 text-sm mt-1">手動設定帳號的客服模組方案（銀行轉帳、優惠贈送等場合使用）</p>
      </div>
      <CsPlansTable />
    </div>
  )
}
