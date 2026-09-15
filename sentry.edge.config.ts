// Edge runtime（middleware.ts 在這裡執行）的 Sentry 設定。
// middleware 是這次事故的另一半現場，它的錯誤一定要收得到。
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  integrations: [
    Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] }),
  ],

  tracesSampleRate: 0,

  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  sendDefaultPii: false,
})
