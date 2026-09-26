import { BookingPlansTable } from './BookingPlansTable'

export default function AdminBookingPlansPage() {
  return (
    <div className="px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">訂房方案管理</h1>
        <p className="text-gray-500 text-sm mt-1">手動設定帳號的訂房模組方案（銀行轉帳、優惠贈送等場合使用）。客服 AI 查訂單／給入住密碼需訂房 PRO 以上。所屬公司開通訂房模組（公司版／專屬客製-企業版）時，「實際生效」一律為 MAX，與帳號自訂方案取較高者。</p>
      </div>
      <BookingPlansTable />
    </div>
  )
}
