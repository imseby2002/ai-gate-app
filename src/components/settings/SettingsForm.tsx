'use client'

import { useState } from 'react'
import { Loader2, User, Wallet, Shield, CheckCircle2, MessageSquare, Eye, EyeOff, ExternalLink, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { CREDIT_PACKAGES, type PackageId } from '@/lib/ecpay/client'
import { SocialPlatformSettings } from './SocialPlatformSettings'

interface SettingsFormProps {
  profile: Profile | null
  creditBalance: number
}

export function SettingsForm({ profile, creditBalance }: SettingsFormProps) {
  const t = useTranslations('Settings')
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [department, setDepartment] = useState(profile?.department ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Telegram settings
  const [tgBotToken, setTgBotToken] = useState(profile?.telegram_bot_token ?? '')
  const [tgChatId, setTgChatId] = useState(profile?.telegram_chat_id ?? '')
  const [showToken, setShowToken] = useState(false)
  const [savingTg, setSavingTg] = useState(false)
  const [savedTg, setSavedTg] = useState(false)
  const [testingTg, setTestingTg] = useState(false)
  const [tgTestResult, setTgTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [topupLoading, setTopupLoading] = useState<PackageId | null>(null)
  const [topupDone, setTopupDone] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ full_name: fullName, department }).eq('id', profile!.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleTopup = async (packageId: PackageId) => {
    setTopupLoading(packageId)
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, returnUrl: window.location.href }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.paymentUrl
      form.target = '_blank'
      for (const [key, value] of Object.entries(data.params)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = String(value)
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
      document.body.removeChild(form)
      setTopupDone(true)
    } catch (err) {
      console.error('topup failed', err)
      alert('Error processing payment. Please try again.')
    } finally {
      setTopupLoading(null)
    }
  }

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingTg(true)
    setTgTestResult(null)
    const supabase = createClient()
    await supabase.from('profiles').update({
      telegram_bot_token: tgBotToken.trim() || null,
      telegram_chat_id: tgChatId.trim() || null,
    }).eq('id', profile!.id)
    setSavingTg(false)
    setSavedTg(true)
    setTimeout(() => setSavedTg(false), 3000)
  }

  const handleTestTelegram = async () => {
    if (!tgBotToken.trim() || !tgChatId.trim()) return
    setTestingTg(true)
    setTgTestResult(null)
    try {
      const res = await fetch(`https://api.telegram.org/bot${tgBotToken.trim()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId.trim(),
          text: '✅ AI GATE 行銷自動化 Telegram 設定成功！\n\n您將在此收到行銷流程的審核通知。',
          parse_mode: 'HTML',
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setTgTestResult({ ok: true, msg: '測試訊息發送成功！請確認 Telegram 是否收到。' })
      } else {
        setTgTestResult({ ok: false, msg: data.description ?? '發送失敗，請確認 Bot Token 與 Chat ID 是否正確。' })
      }
    } catch {
      setTgTestResult({ ok: false, msg: '網路錯誤，請稍後再試。' })
    } finally {
      setTestingTg(false)
    }
  }

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'done' && !topupDone) setTopupDone(true)
  }

  const userTypeLabel = {
    employee: t('typeEmployee'),
    admin: t('typeAdmin'),
    external: t('typeExternal'),
  }[profile?.user_type ?? 'employee']

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile */}
      <div className="bg-card rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <User className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">{t('profile')}</h2>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('email')}</label>
            <input
              type="email"
              value={profile?.email ?? ''}
              disabled
              className="w-full h-10 px-3 rounded-lg border text-sm bg-muted text-muted-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('fullName')}</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('department')}</label>
            <input
              type="text"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-background"
              placeholder={t('departmentPlaceholder')}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--primary)' }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? t('saving') : t('save')}
            </button>
            {saved && <span className="text-sm text-green-600">{t('saved')}</span>}
          </div>
        </form>
      </div>

      {/* Credit Balance & Top-up */}
      <div className="bg-card rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">{t('credits')}</h2>
        </div>

        {topupDone && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            {t('topupDoneMsg')}
          </div>
        )}

        {/* Balance */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border mb-5">
          <div>
            <div className="text-sm text-muted-foreground">{t('currentBalance')}</div>
            <div className="text-2xl font-bold mt-0.5">
              ${creditBalance.toFixed(2)}
              <span className="text-base font-normal text-muted-foreground/60 ml-1">USD</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'color-mix(in oklch, var(--primary) 15%, transparent)' }}>
            <Wallet className="h-5 w-5" style={{ color: 'var(--primary)' }} />
          </div>
        </div>

        {/* Packages */}
        <div className="mb-3 text-sm font-medium text-foreground/70">{t('topupPackages')}</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CREDIT_PACKAGES.map(pkg => (
            <div
              key={pkg.id}
              className="relative rounded-xl border-2 p-4 flex flex-col gap-2"
              style={pkg.badge === '推薦' || pkg.badge === '最超值'
                ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 5%, transparent)' }
                : { borderColor: '#e5e7eb' }
              }
            >
              {pkg.badge && (
                <span
                  className="absolute -top-2.5 left-3 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                  style={{ background: 'var(--primary)' }}
                >
                  {pkg.badge}
                </span>
              )}
              <div className="font-bold text-lg">{pkg.label}</div>
              <div className="text-sm text-muted-foreground">{pkg.desc}</div>
              <button
                onClick={() => handleTopup(pkg.id as PackageId)}
                disabled={topupLoading !== null}
                className="mt-auto flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: 'var(--primary)' }}
              >
                {topupLoading === pkg.id
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('topupProcessing')}</>
                  : t('topupNow')
                }
              </button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground/60">{t('ecpayNote')}</p>
      </div>

      {/* Telegram Integration */}
      <div className="bg-card rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-400" />
            <h2 className="font-semibold">Telegram 整合</h2>
          </div>
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
          >
            申請 Bot Token <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          設定後，自動化行銷流程將透過您的 Telegram Bot 發送審核通知，並接收您的核准或修改回覆。
        </p>

        <form onSubmit={handleSaveTelegram} className="space-y-4">
          {/* Bot Token */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Bot Token
              <span className="ml-2 text-xs font-normal text-gray-400">（從 @BotFather 取得）</span>
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={tgBotToken}
                onChange={e => setTgBotToken(e.target.value)}
                className="w-full h-10 px-3 pr-10 rounded-lg border text-sm outline-none focus:ring-2 font-mono bg-background"
                placeholder="xxxxxxxxxx:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Chat ID */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Chat ID / 使用者名稱
              <span className="ml-2 text-xs font-normal text-gray-400">（預設收通知的對象）</span>
            </label>
            <input
              type="text"
              value={tgChatId}
              onChange={e => setTgChatId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-background"
              placeholder="@username 或 -100xxxxxxxxxx（群組）"
            />
            <p className="text-xs text-muted-foreground/70 mt-1.5">
              個人 Chat ID 可傳訊給 <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">@userinfobot</a> 查詢；群組請將 Bot 加入後取得群組 ID。
            </p>
          </div>

          {/* Test result */}
          {tgTestResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
              tgTestResult.ok
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {tgTestResult.ok
                ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                : <Loader2 className="h-4 w-4 flex-shrink-0 mt-0.5" />}
              {tgTestResult.msg}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingTg}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--primary)' }}
            >
              {savingTg && <Loader2 className="h-4 w-4 animate-spin" />}
              {savingTg ? '儲存中…' : '儲存設定'}
            </button>
            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={testingTg || !tgBotToken.trim() || !tgChatId.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border hover:bg-accent disabled:opacity-50 transition-colors"
            >
              {testingTg && <Loader2 className="h-4 w-4 animate-spin" />}
              {testingTg ? '傳送中…' : '傳送測試訊息'}
            </button>
            {savedTg && <span className="text-sm text-green-600">✓ 已儲存</span>}
          </div>
        </form>
      </div>

      {/* Social Platform Connections */}
      <div className="bg-card rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Share2 className="h-5 w-5 text-gray-400" />
          <h2 className="font-semibold">社群平台連結</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          設定後，行銷自動化流程將自動上傳圖片與影片至對應平台。各平台 Token 請至官方開發者後台取得。
        </p>
        <SocialPlatformSettings />
      </div>

      {/* Account Info */}
      <div className="bg-card rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">{t('accountInfo')}</h2>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">{t('accountType')}</span>
            <span className="font-medium">{userTypeLabel}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">{t('accountStatus')}</span>
            <span className={`font-medium ${profile?.is_active ? 'text-green-600' : 'text-red-600'}`}>
              {profile?.is_active ? t('active') : t('inactive')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
