'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

// 這些路由本身就有專屬 PWA manifest（display: standalone）——每日入住記錄、客服
// 收件夾都是設計給商家加到手機主畫面、當獨立 App 用的單一用途頁面。用一般瀏覽器
// 分頁開啟時維持完整的外層選單列（切換其他工具、語言、帳號選單），但透過「加到
// 主畫面」以獨立 App 開啟時，外層選單列完全用不到（沒有地方可以切去別的工具），
// 只會佔掉手機寶貴的螢幕空間，把真正有用的內容往下擠——真實案例：客服反映手機版
// 安裝後上面塞了兩層標題列，滑好久才看到訊息。只有「這些路由 + 真的是獨立 App
// 模式」才隱藏外層選單列，一般瀏覽器瀏覽時不受影響。
const MINIMAL_CHROME_ROUTES = ['/cs/inbox', '/booking/daily']

export function isMinimalChromeStandalone(pathname: string | null): boolean {
  if (!pathname) return false
  return MINIMAL_CHROME_ROUTES.some(r => pathname.startsWith(r))
}

export function useStandaloneDisplay(): boolean {
  const [standalone, setStandalone] = useState(false)
  useEffect(() => {
    setStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    )
  }, [])
  return standalone
}

export function CollapsibleAppHeader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const standalone = useStandaloneDisplay()
  if (standalone && isMinimalChromeStandalone(pathname)) return null
  return <>{children}</>
}
