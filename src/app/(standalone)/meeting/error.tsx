'use client'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function MeetingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Meeting Error Boundary]', error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center p-8 text-center min-h-[50vh]">
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-bold text-foreground mb-2">會議系統載入異常</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {error.message || '載入會議模組時發生問題，請嘗試重試或重新整理頁面。'}
      </p>
      {error.digest && (
        <p className="text-xs font-mono text-muted-foreground/60 mb-4">錯誤代碼: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <Button onClick={() => reset()} variant="default" className="gap-2">
          <RefreshCw className="w-4 h-4" /> 重新載入
        </Button>
        <Link href="/menu">
          <Button variant="outline" className="gap-2">
            <Home className="w-4 h-4" /> 回到主選單
          </Button>
        </Link>
      </div>
    </div>
  )
}
