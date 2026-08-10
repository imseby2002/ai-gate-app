'use client'

import { NextIntlClientProvider, IntlErrorCode } from 'next-intl'
import type { ReactNode } from 'react'

/**
 * 包一層 NextIntlClientProvider，讓「缺翻譯 key」不會讓 client component 整頁崩潰。
 * 伺服器端的 fallback 在 src/i18n/request.ts（以英文為基底深度合併）；這裡是 client 端的同等防線。
 */
export function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: string
  messages: Record<string, unknown>
  children: ReactNode
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={(error) => {
        if (error.code === IntlErrorCode.MISSING_MESSAGE) return
        console.error(error)
      }}
      getMessageFallback={({ namespace, key }) => (namespace ? `${namespace}.${key}` : key)}
    >
      {children}
    </NextIntlClientProvider>
  )
}
