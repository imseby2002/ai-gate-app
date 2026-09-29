import { RefreshCw, AlertTriangle } from 'lucide-react'

// 平台卡片上的權杖自動更新狀態（資料來自 /api/cron/refresh-tokens 寫回的 token_expires_at / last_refresh_error）
export default function TokenRefreshStatus({ values }: { values?: Record<string, string> }) {
  const expires = values?.token_expires_at
  const error = values?.last_refresh_error
  if (!expires && !error) return null
  const fmt = (iso: string) => new Date(iso).toLocaleString('zh-TW', { hour12: false })
  return (
    <div className="mb-3 space-y-1 text-[11px]">
      {expires && (
        <p className="flex items-center gap-1 text-muted-foreground">
          <RefreshCw className="h-3 w-3" /> 權杖自動更新中｜目前權杖到期：{fmt(expires)}
        </p>
      )}
      {error && (
        <p className="flex items-start gap-1 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> 上次自動更新失敗：{error}（請重新取得並貼上 Refresh Token）
        </p>
      )}
    </div>
  )
}
