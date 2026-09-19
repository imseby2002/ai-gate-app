'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// root layout 本身在 render 時炸掉時，Next.js 會用這個畫面取代整個頁面。
// 之前沒有這個檔案，這類錯誤只會變成一片空白，使用者看不到訊息、我們也收不到回報。
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>頁面發生錯誤</h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          請重新整理再試一次。若持續發生，請聯絡我們。
        </p>
        {error.digest && (
          <p style={{ color: '#999', fontSize: '0.75rem', marginTop: '1.5rem' }}>
            錯誤代碼：{error.digest}
          </p>
        )}
      </body>
    </html>
  )
}
