'use client'
import { useEffect, useState } from 'react'
import { Download, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallDailyButton({ label, iosHint }: { label: string; iosHint: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(true) // 預設 true，確認非獨立模式才顯示，避免閃爍
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    const sa =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    setStandalone(sa)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setStandalone(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // 已從主畫面開啟（已安裝）就不顯示
  if (standalone) return null

  async function onClick() {
    if (deferred) {
      await deferred.prompt()
      setDeferred(null)
      return
    }
    // iOS / 不支援自動安裝的瀏覽器：顯示手動加入主畫面說明
    setShowHint(v => !v)
  }

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100">
        <Download className="h-4 w-4" />
        {label}
      </button>
      {showHint && !deferred && (
        <div className="absolute right-0 mt-1 w-64 z-20 text-xs bg-white border rounded-lg shadow-lg p-3 text-gray-600 flex gap-2">
          <Share className="h-4 w-4 shrink-0 text-indigo-500 mt-0.5" />
          <span>{iosHint}</span>
        </div>
      )}
    </div>
  )
}
