'use client'

import { useCallback, useEffect, useState } from 'react'
import { Server, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react'

interface HealthResult {
  configured: boolean
  url?: string
  ok?: boolean
  status_code?: number
  response_time_ms?: number
  error?: string
  checked_at: string
}

export default function ScraperHealthPage() {
  const [result, setResult] = useState<HealthResult | null>(null)
  const [loading, setLoading] = useState(true)

  const check = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/scraper-health')
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ configured: true, ok: false, error: '無法連線到本站 API', checked_at: new Date().toISOString() })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    check()
    const timer = setInterval(check, 60000)
    return () => clearInterval(timer)
  }, [check])

  const status: 'unconfigured' | 'up' | 'down' | 'checking' =
    loading && !result ? 'checking' : !result?.configured ? 'unconfigured' : result.ok ? 'up' : 'down'

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Server className="h-6 w-6 text-violet-500" />
        <div>
          <h1 className="text-xl font-bold">OTA Scraper 健康檢查</h1>
          <p className="text-sm text-muted-foreground">監控部署在 Fly.io 上的 OTA 房源爬蟲微服務（curl_cffi + Camoufox），每 60 秒自動重新檢查。</p>
        </div>
      </div>

      <div className={`rounded-2xl border p-6 shadow-sm transition-colors ${
        status === 'up' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900'
        : status === 'down' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
        : status === 'unconfigured' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
        : 'bg-card'
      }`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {status === 'up' && <CheckCircle2 className="h-8 w-8 text-emerald-600" />}
            {status === 'down' && <XCircle className="h-8 w-8 text-red-600" />}
            {status === 'unconfigured' && <AlertTriangle className="h-8 w-8 text-amber-600" />}
            {status === 'checking' && <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />}
            <div>
              <div className="font-bold text-lg">
                {status === 'up' && '運作中'}
                {status === 'down' && '無回應 / 異常'}
                {status === 'unconfigured' && '未設定'}
                {status === 'checking' && '檢查中...'}
              </div>
              {result?.url && <div className="text-xs text-muted-foreground font-mono mt-0.5">{result.url}</div>}
            </div>
          </div>
          <button
            onClick={check}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            重新檢查
          </button>
        </div>

        {result && result.configured && (
          <div className="mt-4 pt-4 border-t border-current/10 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {result.status_code != null && (
              <div>
                <div className="text-xs text-muted-foreground">HTTP 狀態</div>
                <div className="font-semibold">{result.status_code}</div>
              </div>
            )}
            {result.response_time_ms != null && (
              <div>
                <div className="text-xs text-muted-foreground">回應時間</div>
                <div className="font-semibold">{result.response_time_ms} ms</div>
              </div>
            )}
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />最後檢查</div>
              <div className="font-semibold">{new Date(result.checked_at).toLocaleTimeString('zh-TW')}</div>
            </div>
          </div>
        )}

        {result?.error && (
          <div className="mt-3 text-xs text-red-700 dark:text-red-400 font-mono bg-red-100/50 dark:bg-red-950/40 rounded-lg p-2 break-all">
            {result.error}
          </div>
        )}
      </div>

      <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900 rounded-xl p-4 text-sm text-violet-800 dark:text-violet-300">
        <p className="font-medium mb-1">說明</p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>此頁檢查 <code>OTA_SCRAPER_URL/health</code> 是否可連線並回傳正常結果，用來確認 Fly.io 上的爬蟲服務是否存活。</li>
          <li>此爬蟲是 OTA 房源匯入（<code>/api/booking/import</code>）的第二順位方法（ScrapFly 失敗後才會呼叫），單獨異常不代表匯入功能完全失效。</li>
          <li>若顯示「未設定」，代表 Vercel 尚未設定 <code>OTA_SCRAPER_URL</code> 環境變數。</li>
          <li>若顯示「無回應 / 異常」，可能是 Fly.io 機器休眠中（<code>auto_stop_machines</code>）需要冷啟動、或服務本身掛掉，建議用 <code>fly status -a ota-scraper</code> / <code>fly logs -a ota-scraper</code> 進一步排查。</li>
        </ul>
      </div>
    </div>
  )
}
