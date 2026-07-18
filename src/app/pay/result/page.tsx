import { PayResult } from './PayResult'

export const dynamic = 'force-dynamic'

// 付款結果頁（公開，免登入）。ECPay 付款完成會把瀏覽器「跨站 POST」導回這裡，
// 跨站 POST 不會帶登入 cookie，所以這頁刻意不需要登入即可顯示；顯示成功訊息後
// 再由客戶端做「同源 GET」導回原頁（此時 cookie 正常，仍是登入狀態）。
export default async function PayResultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; next?: string }>
}) {
  const sp = await searchParams
  const status: 'done' | 'cancel' = sp.status === 'cancel' ? 'cancel' : 'done'
  const type: 'credit' | 'plan' = sp.type === 'plan' ? 'plan' : 'credit'
  const rawNext = sp.next ?? ''
  // 只接受站內相對路徑，避免開放重導；非法時退回該類型的預設頁
  const next =
    rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : type === 'credit'
        ? '/settings'
        : '/cs'

  return <PayResult status={status} type={type} next={next} />
}
