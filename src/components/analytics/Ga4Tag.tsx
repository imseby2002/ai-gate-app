import Script from 'next/script'

// GA4 追蹤碼（gtag.js）。measurementId 由伺服器端讀平台設定並驗證格式（G-XXXX）後傳入。
// https://developers.google.com/analytics/devguides/collection/ga4
export default function Ga4Tag({ measurementId }: { measurementId: string | null }) {
  if (!measurementId) return null
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}');`}
      </Script>
    </>
  )
}
