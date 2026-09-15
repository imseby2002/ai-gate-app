// Server（Node.js runtime）的 Sentry 設定。由 src/instrumentation.ts 載入。
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 沒設 DSN 時 SDK 自動停用、不會送出任何請求，也不會讓程式壞掉。
  // 所以這份設定先進 main 是安全的，等環境變數填好才會開始收資料。
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 這次 /roundtable 的事故重點：錯誤是被「吞掉」的，只有 console.error，
  // 沒有任何例外被丟出來。只收 unhandled exception 的話這種問題一樣查不到，
  // 所以把 console.error / console.warn 也一併收進 Sentry。
  integrations: [
    Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] }),
  ],

  // 只做錯誤追蹤，不開效能追蹤（會依請求量計費）。
  tracesSampleRate: 0,

  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // 預設不送 cookie / header / body，避免把 access token 或客人資料送到第三方。
  sendDefaultPii: false,
})
