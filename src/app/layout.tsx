import type { Metadata, Viewport } from "next";
import { getLocale, getMessages } from 'next-intl/server'
import { IntlProvider } from '@/components/layout/IntlProvider'
import { ScopeManager } from '@/components/layout/ScopeManager'
import { ServiceWorkerRegister } from '@/components/layout/ServiceWorkerRegister'
import "./globals.css";

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "AI GATE - Enterprise AI Platform",
  description: "Multi-model AI assistant platform supporting DeepSeek, Gemini, Claude, Perplexity and more",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AI Gate",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let locale = 'zh-TW'
  let messages: Record<string, unknown> = {}
  try {
    locale = await getLocale()
    messages = await getMessages()
  } catch {
    // Fallback: load default locale directly
    try {
      messages = (await import('../../messages/zh-TW.json')).default as Record<string, unknown>
    } catch {
      messages = {}
    }
  }

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="h-full">
        <IntlProvider locale={locale} messages={messages}>
          <ScopeManager />
          <ServiceWorkerRegister />
          {children}
        </IntlProvider>
      </body>
    </html>
  );
}
