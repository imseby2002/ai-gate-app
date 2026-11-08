'use client'

import { useState, useSyncExternalStore } from 'react'

const noop = () => () => {}

export function ShareActions({ app, text, lineUrl, labels }: {
  app: 'line' | 'zalo'
  text: string
  lineUrl: string
  labels: { line: string; share: string; copy: string; copied: string; openZalo: string; hint: string }
}) {
  const [copied, setCopied] = useState(false)
  // 伺服器端一律 false；瀏覽器支援 Web Share（多為手機）時才顯示分享按鈕
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === 'function', () => false)

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true) } catch { /* 不支援時請長按文字複製 */ }
  }
  const btn = 'block w-full rounded-xl px-4 py-3 text-center text-sm font-bold'

  return (
    <div className="space-y-2">
      {app === 'line' && <a href={lineUrl} className={`${btn} bg-[#06C755] text-white`}>{labels.line}</a>}
      {canShare && (
        <button type="button" onClick={() => navigator.share({ text }).catch(() => {})} className={`${btn} bg-indigo-600 text-white`}>
          {labels.share}
        </button>
      )}
      <button type="button" onClick={copy} className={`${btn} border bg-white text-slate-800`}>{copied ? labels.copied : labels.copy}</button>
      {app === 'zalo' && <a href="https://chat.zalo.me/" target="_blank" rel="noreferrer" className={`${btn} border bg-white text-[#0068FF]`}>{labels.openZalo}</a>}
      <p className="text-xs text-slate-500">{labels.hint}</p>
    </div>
  )
}
