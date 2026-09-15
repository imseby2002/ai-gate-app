import * as Sentry from '@sentry/nextjs'

// Next.js 會在 server 啟動時呼叫一次，依 runtime 載入對應的 Sentry 設定。
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Server Component / Route Handler 裡沒被接住的錯誤會走這裡。
// 這次 (app)/layout.tsx 的問題如果是用 throw 而不是靜靜 redirect，就會被這個 hook 攔到。
export const onRequestError = Sentry.captureRequestError
