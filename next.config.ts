import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin'
import { withSentryConfig } from '@sentry/nextjs'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  typescript: {
    // 避免歷史邊緣頁面型別推導差異阻礙 Vercel 上線部署
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**.fal.run" },
      { protocol: "https", hostname: "**.fal.ai" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // 沒有 SENTRY_AUTH_TOKEN 時完全不上傳 source map：build 不會對外連線，
  // 也就不會因為 Sentry 沒設好而讓部署失敗。
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },

  silent: true,
  telemetry: false,
  // 移除 production bundle 裡的 Sentry debug log。
  disableLogger: true,
})
