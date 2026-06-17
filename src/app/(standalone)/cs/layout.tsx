import type { Metadata } from 'next'

// 讓整個 /cs 客服區（首頁、收件夾、客戶、設定）都掛上「客服收件夾」PWA manifest，
// 這樣從客服首頁按「安裝手機」安裝的就是收件夾 App（start_url=/cs/inbox）。
// 只設 manifest / appleWebApp，不覆蓋各頁 title。
export const metadata: Metadata = {
  manifest: '/manifest-cs.webmanifest',
  appleWebApp: {
    capable: true,
    title: '客服收件夾',
    statusBarStyle: 'default',
  },
}

export default function CsLayout({ children }: { children: React.ReactNode }) {
  return children
}
