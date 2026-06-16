import type { Metadata } from 'next'

// 讓 /cs/inbox 使用「客服收件夾」專用 PWA manifest：
// 手機從此頁加入主畫面後，會是獨立 App 圖示、開啟直接進收件夾（standalone 全螢幕），
// 可隨時回覆 LINE / WhatsApp / Telegram 等各平台客戶訊息。
export const metadata: Metadata = {
  title: '客服收件夾',
  manifest: '/manifest-cs.webmanifest',
  appleWebApp: {
    capable: true,
    title: '客服收件夾',
    statusBarStyle: 'default',
  },
}

export default function CsInboxLayout({ children }: { children: React.ReactNode }) {
  return children
}
