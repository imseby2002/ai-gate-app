import { CsSupportRequestsTable } from './CsSupportRequestsTable'

export default function AdminCsSupportRequestsPage() {
  return (
    <div className="px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CS 客製功能／問題反映</h1>
        <p className="text-gray-500 text-sm mt-1">
          客戶送出的「客製功能需求」與「問題反映」清單。客製功能已依方案顯示參考價（需審核，複雜功能另議建置費+月維護費）。
        </p>
      </div>
      <CsSupportRequestsTable />
    </div>
  )
}
