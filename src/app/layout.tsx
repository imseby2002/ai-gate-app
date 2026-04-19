import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import "./globals.css";

export const runtime = 'edge'

export const metadata: Metadata = {
  title: "AI GATE - Enterprise AI Platform",
  description: "Multi-model AI assistant platform supporting DeepSeek, Gemini, Claude, Perplexity and more",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="h-full">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
