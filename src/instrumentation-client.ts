// 瀏覽器端的 Sentry 設定。Next.js 會自動載入這個檔案。
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 瀏覽器端只收 console.error。console.warn 在前端太吵（第三方套件、React 的
  // 開發提示都會寫），收進來只會把真正的錯誤淹掉。
  integrations: [
    Sentry.captureConsoleIntegration({ levels: ['error'] }),
  ],

  tracesSampleRate: 0,

  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  sendDefaultPii: false,
})

// 讓 Sentry 能標出使用者是在哪一次換頁時出錯的。
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
