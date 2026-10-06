'use client'

import { useState, useEffect, use } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import PayslipView from '@/components/hr/PayslipView'

// 舊的單月薪資條連結：員工專區上線後保留 30 天過渡期，期間顯示新網址提醒，之後停用
export default function PublicPayslipPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    fetch(`/api/hr/payroll/payslip/${token}`)
      .then(async r => {
        const j = await r.json()
        setPortalUrl(j.portal_url ?? null)
        if (!r.ok) throw new Error(j.error || 'Phiếu lương không hợp lệ')
        return j.payslip
      })
      .then(p => {
        setData(p)
        setConfirmed(!!p.payslip_confirmed)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [token])

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      const r = await fetch(`/api/hr/payroll/payslip/${token}`, { method: 'POST' })
      if (!r.ok) throw new Error('Không thể xác nhận')
      setConfirmed(true)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Xác nhận thất bại')
    }
    setConfirming(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">Không tìm thấy phiếu lương</h2>
          <p className="text-sm text-slate-500">{error || 'Đường dẫn này không tồn tại hoặc đã bị thu hồi.'}</p>
          {portalUrl && (
            <a href={portalUrl} className="inline-block mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold">
              Mở trang nhân viên mới / 前往新的員工專區
            </a>
          )}
        </Card>
      </div>
    )
  }

  const banner = portalUrl ? (
    <Card className="p-4 bg-amber-50 border-amber-300 text-sm text-amber-900 space-y-2">
      <p className="font-bold">Đường dẫn này sắp ngừng sử dụng / 此網址即將停用</p>
      <p>Vui lòng dùng trang nhân viên mới (đăng nhập bằng ngày sinh, sau đó tự đặt mật khẩu). 請改用新的員工專區（用生日登入後設定自己的密碼）：</p>
      <a href={portalUrl} className="block font-mono font-bold text-indigo-700 break-all">{portalUrl}</a>
    </Card>
  ) : null

  return <PayslipView data={data} confirmed={confirmed} confirming={confirming} onConfirm={handleConfirm} banner={banner} />
}
