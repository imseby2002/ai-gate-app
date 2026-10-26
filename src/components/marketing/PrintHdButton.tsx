'use client'

/**
 * 列印用高解析：把成品圖以 AI 放大 4 倍（/api/marketing/ai-studio type=print-hd），
 * 完成後顯示像素與 300 DPI 可印尺寸，並提供下載。放大後檔案也會存進雲端封存區。
 */
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Printer, Download } from 'lucide-react'

const cm = (px: number) => Math.round((px / 300) * 2.54 * 10) / 10

async function downloadFile(url: string, name: string) {
  try {
    const blob = await (await fetch(url)).blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  } catch {
    window.open(url, '_blank')
  }
}

export function PrintHdButton({ imageUrl, compact = false, className = '' }: { imageUrl: string; compact?: boolean; className?: string }) {
  const t = useTranslations('Marketing.printHd')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ src: string; url: string; width: number; height: number } | null>(null)
  const current = result?.src === imageUrl ? result : null

  const run = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/marketing/ai-studio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'print-hd', imageUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.error || t('failed'))
      let { width, height } = data as { width?: number; height?: number }
      if (!width || !height) {
        // fal 未回傳尺寸時由瀏覽器讀取
        const dim = await new Promise<{ w: number; h: number }>(resolve => {
          const img = new Image()
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
          img.onerror = () => resolve({ w: 0, h: 0 })
          img.src = data.url
        })
        width = dim.w; height = dim.h
      }
      setResult({ src: imageUrl, url: data.url, width: width ?? 0, height: height ?? 0 })
      const ext = String(data.url).split('?')[0].split('.').pop() || 'png'
      void downloadFile(data.url, `print-hd-${Date.now()}.${ext}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {current ? (
        <button type="button" onClick={() => downloadFile(current.url, `print-hd-${Date.now()}.${current.url.split('?')[0].split('.').pop() || 'png'}`)}
          className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 ${compact ? 'h-7 text-[11px]' : 'h-8 px-3 text-xs'}`}>
          <Download className="h-3.5 w-3.5" />{t('download')}
        </button>
      ) : (
        <button type="button" onClick={run} disabled={loading}
          className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg border bg-white text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-60 ${compact ? 'h-7 text-[11px]' : 'h-8 px-3 text-xs'}`}
          title={t('hint')}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
          {loading ? t('processing') : t('button')}
        </button>
      )}
      {current && current.width > 0 && (
        <p className="text-[10px] text-gray-500 text-center">
          {t('size', { w: current.width, h: current.height, cw: cm(current.width), ch: cm(current.height) })}
        </p>
      )}
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  )
}
