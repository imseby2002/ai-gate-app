'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function ReserveError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Reserve Module Error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mb-4">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
        預約系統載入異常
      </h2>
      <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
        {error.message || '載入預約模組時發生問題，請點擊下方按鈕重新整理嘗試。'}
      </p>
      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-900/20 active:scale-95"
      >
        <RefreshCw className="h-4 w-4" />
        重新載入模組
      </button>
    </div>
  )
}
