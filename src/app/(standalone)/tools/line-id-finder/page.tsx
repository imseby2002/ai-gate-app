'use client'
import { useEffect, useRef, useState } from 'react'
import { Copy, Check, RefreshCw, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Capture {
  source_type: string
  source_id: string
  raw_text: string | null
  created_at: string
}

const TYPE_LABEL: Record<string, string> = { group: '群組', room: '多人聊天室', user: '個人' }

function randomKey(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function LineIdFinderPage() {
  const [key, setKey] = useState('')
  const [appUrl, setAppUrl] = useState('')
  const [captures, setCaptures] = useState<Capture[]>([])
  const [copied, setCopied] = useState<'url' | 'id' | null>(null)
  const [copiedId, setCopiedId] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setKey(randomKey())
    setAppUrl(window.location.origin)
  }, [])

  useEffect(() => {
    if (!key) return
    const poll = () => {
      fetch(`/api/tools/line-id-finder/${key}`)
        .then(r => r.json())
        .then(d => setCaptures(d.captures ?? []))
        .catch(() => {})
    }
    poll()
    pollRef.current = setInterval(poll, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [key])

  const webhookUrl = key ? `${appUrl}/api/tools/line-id-finder/${key}` : ''

  function copy(text: string, which: 'url' | 'id') {
    navigator.clipboard.writeText(text)
    if (which === 'id') setCopiedId(text)
    setCopied(which)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Search className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">LINE 群組／個人 ID 查詢工具</h1>
          <p className="text-sm text-muted-foreground">暫時把某個 LINE OA 的 Webhook 指到這裡，傳一則訊息就能查到群組或個人的 ID。</p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium">步驟</div>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>複製下方網址，到 <span className="font-medium text-foreground">LINE Developers Console</span> → 該 OA 的 Messaging API → Webhook URL，貼上並按 Verify/儲存（先記下原本的網址，等下要改回去）</li>
          <li>在想查詢的 LINE 群組（或私訊該 OA）傳一則任意訊息</li>
          <li>下方會自動顯示剛剛捕捉到的來源 ID（約 3 秒更新一次）</li>
          <li>查到之後，記得把 Webhook URL 改回原本的網址</li>
        </ol>

        <div className="pt-2">
          <label className="text-xs text-muted-foreground">暫時 Webhook 網址（僅這個瀏覽器分頁有效，重新整理會換一組）</label>
          <div className="flex items-center gap-2 mt-1">
            <input readOnly value={webhookUrl} className="flex-1 text-sm border rounded-lg px-3 py-2 bg-muted text-foreground font-mono" />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copy(webhookUrl, 'url')}>
              {copied === 'url' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              複製
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">捕捉到的訊息來源</div>
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        {captures.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">還沒收到任何訊息，等你在 LINE 傳訊息過來</p>
        ) : (
          <div className="space-y-2">
            {captures.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2 bg-muted">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      {TYPE_LABEL[c.source_type] ?? c.source_type}
                    </span>
                    <span className="text-sm font-mono truncate">{c.source_id}</span>
                  </div>
                  {c.raw_text && <div className="text-xs text-muted-foreground mt-0.5 truncate">訊息內容：{c.raw_text}</div>}
                </div>
                <Button variant="outline" size="sm" className="shrink-0 gap-1 text-xs h-7 px-2" onClick={() => copy(c.source_id, 'id')}>
                  {copied === 'id' && copiedId === c.source_id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  複製
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
