import { CsSupportRequestsTable } from './CsSupportRequestsTable'

export default function AdminCsSupportRequestsPage() {
  return (
    <div className="px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CS 客製功能／問題反映（舊資料）</h1>
        <p className="text-gray-500 text-sm mt-1">
          這裡只保留舊資料。新的 CS 客製功能／問題反映已併入全模組統一的
          <a href="/admin/feedback" className="text-indigo-600 hover:underline mx-1">意見反映（全模組）</a>
          頁面，不會再有新資料寫進這裡。
        </p>
      </div>
      <CsSupportRequestsTable />
    </div>
  )
}
