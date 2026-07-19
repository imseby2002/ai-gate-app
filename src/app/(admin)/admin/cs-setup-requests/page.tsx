import { CsSetupRequestsTable } from './CsSetupRequestsTable'

export default function AdminCsSetupRequestsPage() {
  return (
    <div className="px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CS 協助設定請求</h1>
        <p className="text-gray-500 text-sm mt-1">
          客戶送出「找人幫我設定」的請求清單。可標記處理狀態，或一鍵「代客戶設定」切進他的客服帳號直接幫他設定。
        </p>
      </div>
      <CsSetupRequestsTable />
    </div>
  )
}
