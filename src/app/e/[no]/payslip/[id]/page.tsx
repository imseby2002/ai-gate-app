'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import PayslipView from '@/components/hr/PayslipView'

export default function PortalPayslipPage({ params }: { params: Promise<{ no: string; id: string }> }) {
  const { no, id } = use(params)
  const router = useRouter()
  const api = `/api/e/${encodeURIComponent(no)}/payslip/${id}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    fetch(api).then(async r => {
      // 未登入或不屬於本人 → 回員工專區登入頁
      if (!r.ok) { router.replace(`/e/${encodeURIComponent(no)}`); return }
      const d = await r.json()
      setData(d.payslip)
      setConfirmed(!!d.payslip.payslip_confirmed)
    })
  }, [api, no, router])

  async function confirm() {
    setConfirming(true)
    const r = await fetch(api, { method: 'POST' })
    if (r.ok) setConfirmed(true)
    setConfirming(false)
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
  }

  const back = (
    <a href={`/e/${encodeURIComponent(no)}`} className="text-sm text-indigo-700">← Trang nhân viên / 員工專區</a>
  )
  return <PayslipView data={data} confirmed={confirmed} confirming={confirming} onConfirm={confirm} banner={back} />
}
