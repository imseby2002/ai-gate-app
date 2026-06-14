import type { Metadata } from 'next'

// 讓 /booking/daily 使用「每日入住」專用 PWA manifest：
// 手機從此頁加入主畫面後，會是獨立 App 圖示、開啟直接進每日入住（standalone 全螢幕）。
export const metadata: Metadata = {
  title: '每日入住',
  manifest: '/manifest-daily.webmanifest',
  appleWebApp: {
    capable: true,
    title: '每日入住',
    statusBarStyle: 'default',
  },
}

export default function DailyLayout({ children }: { children: React.ReactNode }) {
  return children
}
