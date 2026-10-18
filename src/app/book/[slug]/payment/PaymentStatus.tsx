'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'

type S = { payment_status: string; status: string } | null

export default function PaymentStatus({ slug, code }: { slug: string; code: string }) {
  const [s, setS] = useState<S>(null)
  const [tries, setTries] = useState(0)

  // 綠界背景通知可能比瀏覽器導回晚幾秒，未付款時每 3 秒重查，最多約 30 秒
  useEffect(() => {
    if (!code) return
    let stop = false
    fetch(`/api/book/${slug}/payment-status?code=${encodeURIComponent(code)}`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(d => {
        if (stop) return
        if (d) setS(d)
        if (d?.payment_status !== 'paid' && tries < 10) setTimeout(() => setTries(t => t + 1), 3000)
      })
    return () => { stop = true }
  }, [slug, code, tries])

  const paid = s?.payment_status === 'paid'
  const waiting = !!code && !paid && tries < 10

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
      {paid ? <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
        : waiting ? <Loader2 className="w-12 h-12 text-gray-400 mx-auto animate-spin" />
        : <XCircle className="w-12 h-12 text-red-400 mx-auto" />}
      <h1 className="text-xl font-bold text-gray-900">
        {paid ? '付款完成！' : waiting ? '確認付款中…' : '尚未完成付款'}
      </h1>
      {code && <p className="text-sm text-gray-500">確認碼：<span className="font-mono font-bold text-gray-900">{code}</span></p>}
      <p className="text-sm text-gray-600">
        {paid
          ? (s?.status === 'confirmed' ? '訂房已成立，確認信已寄到您的信箱。' : '已收到您的付款，業者確認後會寄確認信給您。')
          : waiting ? '請稍候，正在向綠界確認付款結果。'
          : '若已扣款請聯絡民宿；若尚未付款，可重新訂房或聯絡民宿協助。'}
      </p>
      <Link href={`/book/${slug}`} className="inline-block text-sm text-blue-600 hover:underline">回民宿首頁</Link>
    </div>
  )
}
