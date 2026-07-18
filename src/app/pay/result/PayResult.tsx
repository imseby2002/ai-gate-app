'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

interface Props {
  status: 'done' | 'cancel'
  type: 'credit' | 'plan'
  next: string
}

export function PayResult({ status, type, next }: Props) {
  const [seconds, setSeconds] = useState(3)
  const ok = status === 'done'

  useEffect(() => {
    if (!ok) return
    const timer = setInterval(() => setSeconds(s => s - 1), 1000)
    // 用整頁導覽（非 client router）確保回到原頁時是伺服器重新渲染，餘額／方案狀態最新
    const go = setTimeout(() => { window.location.href = next }, 3000)
    return () => { clearInterval(timer); clearTimeout(go) }
  }, [ok, next])

  const title = ok
    ? (type === 'credit' ? '刷卡成功，點數已入帳！' : '刷卡成功，方案已升級！')
    : '付款未完成'
  const desc = ok
    ? (type === 'credit'
        ? '感謝購買，點數已加入你的帳戶，可立即使用。'
        : '感謝購買，方案已生效，功能已解鎖。')
    : '這次付款沒有完成，未扣款。你可以返回重新購買。'

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-background dark:to-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        {ok
          ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
          : <XCircle className="mx-auto h-14 w-14 text-amber-500" />}
        <h1 className="mt-4 text-lg font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>

        <a
          href={next}
          className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:opacity-90 transition-opacity"
        >
          {ok && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          返回{ok ? `（${seconds > 0 ? seconds : 0} 秒後自動跳轉）` : '重新購買'}
        </a>
      </div>
    </div>
  )
}
