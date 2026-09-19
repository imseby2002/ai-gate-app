'use client'

import { useEffect, useState } from 'react'
import { Bell, Save, Loader2, Send, CheckCircle2, XCircle } from 'lucide-react'

interface TestResult {
  emailSent: boolean
  emailError: string | null
  telegramSent: boolean
  telegramError: string | null
}

export default function NotifySettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [saveMsg, setSaveMsg] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const [notifyEmail, setNotifyEmail] = useState('')
  const [tgBotToken, setTgBotToken] = useState('')
  const [tgChatId, setTgChatId] = useState('')

  useEffect(() => {
    fetch('/api/admin/notify-settings')
      .then(r => r.json())
      .then(d => {
        setNotifyEmail(d.notify_email ?? '')
        setTgBotToken(d.telegram_bot_token ?? '')
        setTgChatId(d.telegram_chat_id ?? '')
        setUpdatedAt(d.updated_at ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await fetch('/api/admin/notify-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notify_email: notifyEmail,
          telegram_bot_token: tgBotToken,
          telegram_chat_id: tgChatId,
        }),
      })
      if (res.ok) {
        setSaveMsg('✅ 已儲存')
        setUpdatedAt(new Date().toISOString())
      } else {
        const d = await res.json().catch(() => ({}))
        setSaveMsg(`❌ 儲存失敗：${d?.error ?? res.statusText}`)
      }
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 4000)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/notify-settings/test', { method: 'POST' })
      const d = await res.json()
      setTestResult(d)
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Bell className="h-6 w-6 text-violet-500" />
        <div>
          <h1 className="text-xl font-bold">通知設定</h1>
          <p className="text-sm text-muted-foreground">設定「CS 協助請求」「意見反映」等後台事件的通知對象，Email 與 Telegram 可同時啟用。</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border p-6 space-y-5 shadow-sm">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email 收件人</label>
          <input
            type="email"
            value={notifyEmail}
            onChange={e => setNotifyEmail(e.target.value)}
            placeholder="imseby@gmail.com（留空使用預設值）"
            className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 transition-all bg-transparent"
          />
        </div>

        <div className="pt-2 border-t space-y-4">
          <div>
            <div className="text-sm font-medium">Telegram（選填）</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              到 Telegram 找 @BotFather 建立 bot 取得 token；把 bot 加進你的聊天室或頻道後，
              用 <code>https://api.telegram.org/bot&lt;token&gt;/getUpdates</code> 可查到 chat id。
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Bot Token</label>
            <input
              type="text"
              value={tgBotToken}
              onChange={e => setTgBotToken(e.target.value)}
              placeholder="123456:ABC-DEF..."
              className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 transition-all bg-transparent font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Chat ID</label>
            <input
              type="text"
              value={tgChatId}
              onChange={e => setTgChatId(e.target.value)}
              placeholder="-1001234567890"
              className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 transition-all bg-transparent font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-bold shadow-xs transition-colors cursor-pointer"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            儲存
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border hover:bg-accent disabled:opacity-60 text-sm font-medium transition-colors cursor-pointer"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            發送測試通知
          </button>
          {saveMsg && <span className="text-xs text-muted-foreground">{saveMsg}</span>}
        </div>

        {testResult && (
          <div className="pt-3 border-t space-y-1.5 text-sm">
            <div className="flex items-center gap-1.5">
              {testResult.emailSent ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
              Email：{testResult.emailSent ? '已送出，請檢查信箱' : (testResult.emailError ?? '失敗')}
            </div>
            <div className="flex items-center gap-1.5">
              {testResult.telegramSent ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
              Telegram：{testResult.telegramSent ? '已送出，請檢查聊天室' : (testResult.telegramError ?? '失敗')}
            </div>
          </div>
        )}

        {updatedAt && (
          <p className="text-xs text-muted-foreground/60 pt-1">上次更新：{new Date(updatedAt).toLocaleString('zh-TW')}</p>
        )}
      </div>

      <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900 rounded-xl p-4 text-sm text-violet-800 dark:text-violet-300">
        <p className="font-medium mb-1">套用範圍</p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>CS 協助請求（找人幫我設定 / 客製功能需求 / 問題反映）送出時</li>
          <li>意見反映（全模組）新回報送出時，以及 AI 自動修復完成／需人工處理時</li>
          <li>Email 未設定時退回環境變數 <code>SUPPORT_NOTIFY_EMAIL</code>；兩個管道都沒設定則只送 Email 給預設地址</li>
        </ul>
      </div>
    </div>
  )
}
