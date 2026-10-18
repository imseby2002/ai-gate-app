import PaymentStatus from './PaymentStatus'

export const dynamic = 'force-dynamic'

// 綠界刷卡完成後導回的結果頁（公開，綠界以跨站 POST 導回）
export default async function BookingPaymentPage({
  params, searchParams,
}: { params: Promise<{ slug: string }>; searchParams: Promise<{ code?: string }> }) {
  const { slug } = await params
  const { code } = await searchParams
  return <PaymentStatus slug={slug} code={code ?? ''} />
}
