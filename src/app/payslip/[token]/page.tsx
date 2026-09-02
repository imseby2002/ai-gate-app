'use client'

import { useState, useEffect, use } from 'react'
import { CheckCircle2, Loader2, AlertCircle, Building2, CreditCard, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function PublicPayslipPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    fetch(`/api/hr/payroll/payslip/${token}`)
      .then(async r => {
        const j = await r.json()
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
    } catch (e: any) {
      alert(e.message || 'Xác nhận thất bại')
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
        </Card>
      </div>
    )
  }

  const emp = data.hr_employees || {}
  const fmt = (n: number | null | undefined) => Math.round(Number(n) || 0).toLocaleString('vi-VN') + ' VND'

  const gross = Math.round(Number(data.gross_salary || (Number(data.base_salary) + Number(data.allowances) + Number(data.bonus))))
  const bhxh = Math.round(Number(data.bhxh_amount || 0))
  const union = Math.round(Number(data.union_fee || 0))
  const pit = Math.round(Number(data.pit_amount || 0))
  const advance = Math.round(Number(data.advance_payment || 0))
  const net = Math.round(Number(data.net_pay || 0))

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 flex justify-center">
      <div className="max-w-xl w-full space-y-4">
        {/* Header Card */}
        <Card className="p-6 bg-gradient-to-br from-indigo-700 to-indigo-900 text-white rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-200 text-sm font-medium">
              <Building2 className="h-4 w-4" />
              <span>{emp.store ? `Cửa hàng ${emp.store}` : 'Công ty IM-TOURIST'}</span>
            </div>
            <span className="text-xs bg-indigo-600/60 px-3 py-1 rounded-full border border-indigo-400/30">
              Chính thức
            </span>
          </div>

          <div className="mt-4">
            <h1 className="text-2xl font-black tracking-tight">PHIẾU LƯƠNG ĐIỆN TỬ</h1>
            <p className="text-indigo-200 text-sm mt-0.5">Tháng {data.month} năm {data.year} (電子薪資條)</p>
          </div>

          <div className="mt-6 pt-4 border-t border-indigo-500/40 grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-indigo-300 block">Họ và tên / 姓名</span>
              <span className="font-bold text-sm text-white">{emp.name || '---'}</span>
            </div>
            <div>
              <span className="text-indigo-300 block">Vị trí / 職稱</span>
              <span className="font-semibold text-white">{emp.position || emp.department || 'Nhân viên'}</span>
            </div>
            <div>
              <span className="text-indigo-300 block">Tài khoản nhận lương / 銀行帳戶</span>
              <span className="font-mono text-white">{emp.bank_name || 'TPBank'}: {emp.bank_account || '---'}</span>
            </div>
            <div>
              <span className="text-indigo-300 block">CCCD / 身分證</span>
              <span className="font-mono text-white">{emp.id_number || '---'}</span>
            </div>
          </div>
        </Card>

        {/* Details Breakdown */}
        <Card className="p-5 bg-white rounded-2xl shadow-sm border space-y-4 text-sm">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">1. CÁC KHOẢN THU NHẬP (應發所得)</h3>
            <div className="space-y-1.5 divide-y divide-slate-100">
              <div className="flex justify-between py-1 text-slate-600">
                <span>Lương cơ bản / 基本底薪</span>
                <span className="font-semibold text-slate-900">{fmt(data.base_salary)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Tổng phụ cấp (Cơm, xe, chuyên cần) / 各項津貼</span>
                <span className="font-semibold text-slate-900">{fmt(data.allowances)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Thưởng hiệu quả / 績效考核獎金</span>
                <span className="font-semibold text-emerald-600">+{fmt(data.bonus)}</span>
              </div>
              {data.audit_adjustment ? (
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Điều chỉnh giờ công / 人工工時微調</span>
                  <span className="font-semibold text-slate-900">{Number(data.audit_adjustment) > 0 ? '+' : ''}{fmt(data.audit_adjustment)}</span>
                </div>
              ) : null}
              <div className="flex justify-between py-2 font-bold text-slate-900 bg-slate-50 px-2 rounded-lg">
                <span>TỔNG THU NHẬP (GROSS) / 應發總額</span>
                <span className="text-indigo-600">{fmt(gross)}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">2. CÁC KHOẢN GIẢM TRỪ (代扣項目)</h3>
            <div className="space-y-1.5 divide-y divide-slate-100">
              <div className="flex justify-between py-1 text-slate-600">
                <span>Bảo hiểm xã hội & Y tế (10.5% BHXH, BHYT, BHTN)</span>
                <span className="font-semibold text-red-600">-{fmt(bhxh)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Đoàn phí công đoàn (1% 工會費)</span>
                <span className="font-semibold text-red-600">-{fmt(union)}</span>
              </div>
              {pit > 0 && (
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Thuế thu nhập cá nhân (PIT / 個人所得稅)</span>
                  <span className="font-semibold text-red-600">-{fmt(pit)}</span>
                </div>
              )}
              {advance > 0 && (
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Tạm ứng lương / 預支款項</span>
                  <span className="font-semibold text-red-600">-{fmt(advance)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Net Salary Highlight */}
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-800 uppercase block">THỰC LĨNH CHUYỂN KHOẢN</span>
              <span className="text-xs text-emerald-600">實發薪資（銀行轉帳）</span>
            </div>
            <span className="text-2xl font-black text-emerald-700">{fmt(net)}</span>
          </div>

          {data.notes && (
            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
              <b>Ghi chú / 備註：</b> {data.notes}
            </div>
          )}

          {/* Confirmation Action */}
          <div className="pt-2">
            {confirmed ? (
              <div className="p-3 bg-emerald-100/80 border border-emerald-300 rounded-xl flex items-center justify-center gap-2 text-emerald-800 font-semibold text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span>Đã xác nhận nhận phiếu lương (已線上簽收確認)</span>
              </div>
            ) : (
              <Button
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow"
              >
                {confirming ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Tôi đã kiểm tra và xác nhận phiếu lương (確認無誤簽收)'}
              </Button>
            )}
          </div>
        </Card>

        <p className="text-center text-xs text-slate-400">
          Hệ thống Quản lý Nhân sự AI GATE • Mọi thắc mắc xin liên hệ quản lý trực tiếp
        </p>
      </div>
    </div>
  )
}
