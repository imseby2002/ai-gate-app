'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Server, ShieldCheck, Activity, Plus, RefreshCw, Trash2, ExternalLink,
  Copy, Check, Sparkles, Send, Users, Layers, AlertCircle, Clock, Zap,
  CheckCircle2, Globe, Lock, Cpu, Play, Terminal, HelpCircle, ArrowUpRight,
  TrendingUp, Hash, MessageSquare, ShieldAlert, Pencil, Building2, Store,
  Tag, CreditCard, Smartphone, CheckCheck, BadgeCheck
} from 'lucide-react'
import {
  SocialProxy, SocialAccount, SocialLog, TargetGroup,
  MatrixCopy, ProxyType, ProxyProtocol, SocialPlatform,
  OfficialRentableProxy, ProxyLease, OfficialProxyStatus
} from '@/lib/social-matrix/types'
import { PlanGate } from '@/components/marketing/PlanGate'

export default function SocialMatrixPage() {
  return (
    <PlanGate allowed={info => info.features.socialMatrix === true} featureName="社群矩陣與自動養號" requiredPlan="PRO 以上">
      <SocialMatrixContent />
    </PlanGate>
  )
}

function SocialMatrixContent() {
  const t = useTranslations('SocialMatrix')
  const [activeTab, setActiveTab] = useState<'proxies' | 'accounts' | 'campaign'>('proxies')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  // 1. Proxies State
  const [proxies, setProxies] = useState<SocialProxy[]>([])
  const [isAddProxyOpen, setIsAddProxyOpen] = useState(false)
  const [isEditProxyOpen, setIsEditProxyOpen] = useState(false)
  const [editingProxy, setEditingProxy] = useState<SocialProxy | null>(null)
  const [testingProxyId, setTestingProxyId] = useState<string | null>(null)
  const [newProxyForm, setNewProxyForm] = useState({
    name: '宜蘭聯禾有線原生靜態 IP',
    proxy_type: 'home_static' as ProxyType,
    protocol: 'http' as ProxyProtocol,
    host: '211.75.142.88',
    port: 28899,
    username: 'gate_user',
    password: '',
    country: 'TW',
    city: '宜蘭',
    isp: '聯禾有線電視 (TBC / 乾淨原生家用寬頻)',
    notes: '家用原生固定 IP，抗封號評級最高',
    batchText: '',
    isBatch: false,
  })

  // 1.1 Official Rentable Proxies & Leases State (官方供租用 IP 資源庫與租賃狀態)
  const [proxySubTab, setProxySubTab] = useState<'my_proxies' | 'official_market' | 'admin_manage'>('my_proxies')
  const [officialProxies, setOfficialProxies] = useState<OfficialRentableProxy[]>([])
  const [leases, setLeases] = useState<ProxyLease[]>([])
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [leaseQuota, setLeaseQuota] = useState<{ quota: number; used: number } | null>(null)
  const [usdTwdRate, setUsdTwdRate] = useState<number | null>(null)
  const [isAddOfficialOpen, setIsAddOfficialOpen] = useState(false)
  const [isEditOfficialOpen, setIsEditOfficialOpen] = useState(false)
  const [editingOfficial, setEditingOfficial] = useState<OfficialRentableProxy | null>(null)
  const [isLeasingId, setIsLeasingId] = useState<string | null>(null)
  const [isReleasingId, setIsReleasingId] = useState<string | null>(null)

  const [newOfficialForm, setNewOfficialForm] = useState({
    name: '🇹🇼 台灣宜蘭聯禾原生住宅 IP #2 (專屬固定)',
    proxy_type: 'home_static' as ProxyType,
    protocol: 'http' as ProxyProtocol,
    host: '211.75.142.99',
    port: 28899,
    username: 'gate_admin',
    password: '',
    country: 'TW',
    city: '宜蘭',
    isp: '聯禾有線電視 (TBC 原生家用住宅寬頻)',
    latency_ms: 18,
    monthly_price_twd: 299,
    max_tenants: 1,
    notes: '家用原生固定 IP，純天然住宅寬頻，抗封號評級最高',
  })


  // 2. Accounts & Warm-up State
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [logs, setLogs] = useState<SocialLog[]>([])
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false)
  const [isWarmingUp, setIsWarmingUp] = useState(false)
  const [newAccountForm, setNewAccountForm] = useState({
    platform: 'facebook' as SocialPlatform,
    account_name: '',
    account_handle: '',
    proxy_id: '',
    warmup_day: 1,
    target_niches: '旅遊, 包車, 自由行',
  })

  // 3. Campaign & Radar & Copy Matrix State
  const [industry, setIndustry] = useState(t('s1.industry'))
  const [coreProduct, setCoreProduct] = useState(t('s1.product'))
  const [targetAudience, setTargetAudience] = useState(t('s1.audience'))
  const [offer, setOffer] = useState(t('s1.offer'))
  const [ctaLink, setCtaLink] = useState(t('s1.cta'))
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['facebook', 'threads', 'dcard', 'instagram'])

  const [isGenerating, setIsGenerating] = useState(false)
  const [targetGroups, setTargetGroups] = useState<TargetGroup[]>([])
  const [copies, setCopies] = useState<MatrixCopy[]>([])
  const [selectedCopyId, setSelectedCopyId] = useState<string>('')
  const [isDispatching, setIsDispatching] = useState(false)
  const [dispatchResult, setDispatchResult] = useState<{ mode: string; message: string; count?: number } | null>(null)

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg({ text, type })
    setTimeout(() => setToastMsg(null), 4000)
  }

  const PROXY_STORAGE_KEY = 'aigate_proxies_cache_v2'

  const saveProxiesLocally = (list: SocialProxy[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(PROXY_STORAGE_KEY, JSON.stringify(list))
      } catch (e) {
        console.warn('Failed to save to localStorage:', e)
      }
    }
  }

  // Initial Data Fetching
  const fetchAllData = async () => {
    setIsLoading(true)
    try {
      const [pRes, aRes, lRes, offRes] = await Promise.all([
        fetch('/api/marketing/social-matrix/proxies').then(r => r.json()).catch(() => ({ proxies: [] })),
        fetch('/api/marketing/social-matrix/accounts').then(r => r.json()).catch(() => ({ accounts: [] })),
        fetch('/api/marketing/social-matrix/warmup').then(r => r.json()).catch(() => ({ logs: [] })),
        fetch('/api/marketing/social-matrix/official-proxies').then(r => r.json()).catch(() => ({ official_proxies: [], leases: [] })),
      ])

      let serverProxies: SocialProxy[] = pRes.proxies || []
      if (offRes.official_proxies) setOfficialProxies(offRes.official_proxies)
      if (offRes.leases) setLeases(offRes.leases)
      setIsPlatformAdmin(offRes.is_admin === true)
      if (typeof offRes.lease_quota === 'number') setLeaseQuota({ quota: offRes.lease_quota, used: offRes.lease_used ?? 0 })
      if (typeof offRes.usd_twd_rate === 'number') setUsdTwdRate(offRes.usd_twd_rate)

      // Merge with browser local storage backup so user configurations are never lost
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(PROXY_STORAGE_KEY)
        if (saved) {
          try {
            const localList: SocialProxy[] = JSON.parse(saved)
            if (Array.isArray(localList) && localList.length > 0) {
              const localMap = new Map(localList.map(p => [p.id, p]))
              // Local updates/renames take precedence
              serverProxies = serverProxies.map(p => localMap.get(p.id) || p)
              // Any new proxies only in local storage
              for (const lp of localList) {
                if (!serverProxies.some(p => p.id === lp.id || (p.host === lp.host && p.port === lp.port))) {
                  serverProxies.unshift(lp)
                }
              }
            }
          } catch (err) {
            console.warn('Error reading local proxy backup:', err)
          }
        }
      }

      setProxies(serverProxies)
      saveProxiesLocally(serverProxies)

      if (aRes.accounts) setAccounts(aRes.accounts)
      if (lRes.logs) setLogs(lRes.logs)
    } catch (err) {
      console.error('Failed to load initial data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
    showToast(t('copied'), 'success')
  }

  // 1. Proxy Actions
  const handleTestProxy = async (proxy: SocialProxy) => {
    setTestingProxyId(proxy.id)
    try {
      const res = await fetch('/api/marketing/social-matrix/proxies/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: proxy.id, host: proxy.host, port: proxy.port }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message, 'success')
        setProxies(prev => {
          const next = prev.map(p => p.id === proxy.id ? { ...p, latency_ms: data.latency_ms, last_checked_at: data.tested_at, status: 'active' as const } : p)
          saveProxiesLocally(next)
          return next
        })
      } else {
        showToast(data.message, 'error')
      }
    } catch (err) {
      showToast(t('speedFail', { error: String(err) }), 'error')
    } finally {
      setTestingProxyId(null)
    }
  }

  const handleAddProxy = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = newProxyForm.isBatch
        ? { batchText: newProxyForm.batchText, proxy_type: newProxyForm.proxy_type, country: newProxyForm.country }
        : newProxyForm

      const res = await fetch('/api/marketing/social-matrix/proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        showToast(t('proxyAdded'), 'success')
        setIsAddProxyOpen(false)
        if (data.proxy) {
          setProxies(prev => {
            const next = [data.proxy, ...prev]
            saveProxiesLocally(next)
            return next
          })
        }
        fetchAllData()
      } else {
        showToast(data.error || t('addFailed'), 'error')
      }
    } catch (err) {
      showToast(String(err), 'error')
    }
  }

  const handleDeleteProxy = async (id: string) => {
    if (!confirm(t('confirmRemoveProxy'))) return
    try {
      await fetch(`/api/marketing/social-matrix/proxies/${id}`, { method: 'DELETE' })
      setProxies(prev => {
        const next = prev.filter(p => p.id !== id)
        saveProxiesLocally(next)
        return next
      })
      showToast(t('proxyRemoved'), 'info')
    } catch (err) {
      showToast(t('deleteFail', { error: String(err) }), 'error')
    }
  }

  const handleOpenEditProxy = (proxy: SocialProxy) => {
    setEditingProxy({ ...proxy })
    setIsEditProxyOpen(true)
  }

  const handleUpdateProxy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProxy) return
    try {
      const res = await fetch(`/api/marketing/social-matrix/proxies/${editingProxy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProxy),
      })
      const data = await res.json()
      if (data.success) {
        showToast(t('proxyUpdated'), 'success')
        setIsEditProxyOpen(false)
        setProxies(prev => {
          const next = prev.map(p => p.id === editingProxy.id ? { ...p, ...editingProxy } : p)
          saveProxiesLocally(next)
          return next
        })
      } else {
        showToast(data.error || t('updateFailed'), 'error')
      }
    } catch (err) {
      showToast(t('updateFail', { error: String(err) }), 'error')
    }
  }

  // 1.2 Official Proxies Actions (官方 IP 租用、退租與管理者維護)
  // 附贈額度用完後，額外 IP 以點數購買（點數＝美金，依匯率換算 monthly_price_twd；與後端 twdToCredits 同算法）
  const hasFreeQuota = isPlatformAdmin || (leaseQuota != null && leaseQuota.used < leaseQuota.quota)
  const creditsFor = (twd: number) => usdTwdRate ? Math.ceil((twd / usdTwdRate) * 100) / 100 : null

  const handleLeaseOfficial = async (offProxy: OfficialRentableProxy) => {
    if (!hasFreeQuota) {
      const credits = creditsFor(offProxy.monthly_price_twd)
      if (!confirm(t('confirmBuy', { credits: String(credits ?? '—') }))) return
    }
    setIsLeasingId(offProxy.id)
    try {
      const res = await fetch('/api/marketing/social-matrix/official-proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lease', official_proxy_id: offProxy.id }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || t('leaseOk'), 'success')
        if (data.proxy) {
          setProxies(prev => {
            const next = [data.proxy, ...prev]
            saveProxiesLocally(next)
            return next
          })
        }
        await fetchAllData()
        setProxySubTab('my_proxies')
      } else {
        showToast(data.error || t('leaseFailed'), 'error')
      }
    } catch (err) {
      showToast(t('leaseFail', { error: String(err) }), 'error')
    } finally {
      setIsLeasingId(null)
    }
  }

  const handleReleaseLease = async (leaseId: string) => {
    if (!confirm(t('confirmRelease'))) return
    setIsReleasingId(leaseId)
    try {
      const res = await fetch(`/api/marketing/social-matrix/official-proxies/lease/${leaseId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || t('released'), 'info')
        setProxies(prev => {
          const next = prev.filter(p => p.lease_id !== leaseId && p.id !== `leased-${leaseId}`)
          saveProxiesLocally(next)
          return next
        })
        await fetchAllData()
      } else {
        showToast(data.error || t('releaseFailed'), 'error')
      }
    } catch (err) {
      showToast(t('releaseErr', { error: String(err) }), 'error')
    } finally {
      setIsReleasingId(null)
    }
  }

  const handleAddOfficialProxy = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/marketing/social-matrix/official-proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_create', ...newOfficialForm }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(t('offListed'), 'success')
        setIsAddOfficialOpen(false)
        await fetchAllData()
      } else {
        showToast(data.error || t('listFailed'), 'error')
      }
    } catch (err) {
      showToast(t('addFail', { error: String(err) }), 'error')
    }
  }

  const handleOpenEditOfficial = (proxy: OfficialRentableProxy) => {
    setEditingOfficial({ ...proxy })
    setIsEditOfficialOpen(true)
  }

  const handleUpdateOfficialProxy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOfficial) return
    try {
      const res = await fetch(`/api/marketing/social-matrix/official-proxies/${editingOfficial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingOfficial),
      })
      const data = await res.json()
      if (data.success) {
        showToast(t('offUpdated'), 'success')
        setIsEditOfficialOpen(false)
        await fetchAllData()
      } else {
        showToast(data.error || t('updateFailed'), 'error')
      }
    } catch (err) {
      showToast(t('updateFail', { error: String(err) }), 'error')
    }
  }

  const handleDeleteOfficialProxy = async (id: string) => {
    if (!confirm(t('confirmUnlist'))) return
    try {
      const res = await fetch(`/api/marketing/social-matrix/official-proxies/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        showToast(t('unlisted'), 'info')
        await fetchAllData()
      } else {
        showToast(data.error || t('deleteFailed'), 'error')
      }
    } catch (err) {
      showToast(t('unlistFail', { error: String(err) }), 'error')
    }
  }


  // 2. Account & Warm-up Actions
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/marketing/social-matrix/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newAccountForm,
          target_niches: newAccountForm.target_niches.split(',').map(s => s.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(t('accAdded'), 'success')
        setIsAddAccountOpen(false)
        setNewAccountForm({
          platform: 'facebook',
          account_name: '',
          account_handle: '',
          proxy_id: '',
          warmup_day: 1,
          target_niches: '旅遊, 包車, 自由行',
        })
        fetchAllData()
      } else {
        showToast(data.error || t('addFailed'), 'error')
      }
    } catch (err) {
      showToast(String(err), 'error')
    }
  }

  const handleDeleteAccount = async (id: string) => {
    if (!confirm(t('confirmRemoveAcc'))) return
    try {
      await fetch(`/api/marketing/social-matrix/accounts/${id}`, { method: 'DELETE' })
      setAccounts(prev => prev.filter(a => a.id !== id))
      showToast(t('accRemoved'), 'info')
    } catch (err) {
      showToast(String(err), 'error')
    }
  }

  const handleRunWarmup = async (accountId?: string) => {
    setIsWarmingUp(true)
    try {
      const res = await fetch('/api/marketing/social-matrix/warmup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, run_all: !accountId }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(t('warmupDone', { n: data.processed_count }), 'success')
        if (data.updated_accounts) setAccounts(data.updated_accounts)
        if (data.latest_logs) setLogs(data.latest_logs)
      } else {
        showToast(data.error || t('warmupFailed'), 'error')
      }
    } catch (err) {
      showToast(t('warmupErr', { error: String(err) }), 'error')
    } finally {
      setIsWarmingUp(false)
    }
  }

  // 3. Campaign & Radar Generation
  const handleGenerateCampaign = async () => {
    setIsGenerating(true)
    setDispatchResult(null)
    try {
      const res = await fetch('/api/marketing/social-matrix/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry,
          core_product: coreProduct,
          target_audience: targetAudience,
          offer,
          cta_link: ctaLink,
          platforms: selectedPlatforms,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setTargetGroups(data.target_groups || [])
        setCopies(data.copies || [])
        if (data.copies?.length > 0) {
          setSelectedCopyId(data.copies[0].id)
        }
        showToast(t('radarDone', { groups: data.target_groups?.length || 0, copies: data.copies?.length || 0 }), 'success')
      } else {
        showToast(data.error || t('genFailed'), 'error')
      }
    } catch (err) {
      showToast(t('genErr', { error: String(err) }), 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  // Dispatch Mode A (Copilot)
  const handleDispatchModeA = async (group: TargetGroup, copy: MatrixCopy) => {
    setIsDispatching(true)
    try {
      // 1. Copy text to clipboard
      const textToPublish = `${copy.title}\n\n${copy.content}\n\n${copy.hashtags.join(' ')}`
      navigator.clipboard.writeText(textToPublish)
      setCopiedId(copy.id)

      // 2. Open group URL in new window
      window.open(group.url, '_blank')

      // 3. Record log
      const res = await fetch('/api/marketing/social-matrix/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'copilot',
          group_name: group.name,
          platform: group.platform,
          copy_id: copy.id,
          copy_title: copy.title,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(t('planAOk', { name: group.name }), 'success')
        fetchAllData()
      }
    } catch (err) {
      showToast(t('opFail', { error: String(err) }), 'error')
    } finally {
      setIsDispatching(false)
    }
  }

  // Dispatch Mode B (Matrix Auto Queue)
  const handleDispatchModeB = async () => {
    const selectedCopy = copies.find(c => c.id === selectedCopyId) || copies[0]
    if (!selectedCopy) {
      showToast(t('needCopies'), 'error')
      return
    }

    const matureCount = accounts.filter(a => a.status === 'mature' || a.warmup_day >= 12).length
    if (matureCount === 0) {
      showToast(t('noMature'), 'error')
      return
    }

    setIsDispatching(true)
    try {
      const res = await fetch('/api/marketing/social-matrix/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'matrix_auto',
          copy_id: selectedCopy.id,
          copy_title: selectedCopy.title,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setDispatchResult({
          mode: 'matrix_auto',
          message: data.message,
          count: data.dispatched?.length,
        })
        showToast(data.message, 'success')
        fetchAllData()
      } else {
        showToast(data.error || t('publishFailed'), 'error')
      }
    } catch (err) {
      showToast(t('scheduleErr', { error: String(err) }), 'error')
    } finally {
      setIsDispatching(false)
    }
  }

  // Helper counters
  const activeProxiesCount = proxies.filter(p => p.status === 'active').length
  const matureAccountsCount = accounts.filter(a => a.status === 'mature').length
  const warmingAccountsCount = accounts.filter(a => a.status === 'warming').length
  const avgHealthScore = accounts.length > 0
    ? Math.round(accounts.reduce((acc, a) => acc + a.health_score, 0) / accounts.length)
    : 0

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-background pb-16">
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
          toastMsg.type === 'success'
            ? 'bg-emerald-500 text-white border-emerald-400'
            : toastMsg.type === 'error'
            ? 'bg-rose-500 text-white border-rose-400'
            : 'bg-indigo-600 text-white border-indigo-500'
        }`}>
          {toastMsg.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-800 text-white px-6 py-8 shadow-md">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-2">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <span>{t('heroTag')}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                {t('heroTitle')}
              </h1>
              <p className="text-indigo-100 text-sm mt-1 max-w-2xl">
                {t('heroDesc')}
              </p>
            </div>

            {/* Quick Live Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15">
              <div className="px-3 py-1 text-center">
                <span className="text-[11px] text-indigo-200 block">{t('statOnline')}</span>
                <span className="text-lg font-bold text-white flex items-center justify-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  {activeProxiesCount}
                </span>
              </div>
              <div className="px-3 py-1 text-center border-l border-white/10">
                <span className="text-[11px] text-indigo-200 block">{t('statMature')}</span>
                <span className="text-lg font-bold text-emerald-300">{matureAccountsCount}</span>
              </div>
              <div className="px-3 py-1 text-center border-l border-white/10">
                <span className="text-[11px] text-indigo-200 block">{t('statWarming')}</span>
                <span className="text-lg font-bold text-amber-300">{warmingAccountsCount}</span>
              </div>
              <div className="px-3 py-1 text-center border-l border-white/10">
                <span className="text-[11px] text-indigo-200 block">{t('statHealth')}</span>
                <span className="text-lg font-bold text-cyan-300">{avgHealthScore}%</span>
              </div>
            </div>
          </div>

          {/* Master Tabs */}
          <div className="flex gap-2 mt-6 border-b border-indigo-500/40 pb-0">
            <button
              onClick={() => setActiveTab('proxies')}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-t-xl transition-all ${
                activeTab === 'proxies'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-indigo-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Server className="h-4 w-4" />
              <span>🌐 {t('tabProxies')} ({proxies.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-t-xl transition-all ${
                activeTab === 'accounts'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-indigo-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Cpu className="h-4 w-4" />
              <span>🤖 {t('tabAccounts')} ({accounts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('campaign')}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-t-xl transition-all ${
                activeTab === 'campaign'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-indigo-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>🚀 {t('tabCampaign')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* TAB 1: PROXIES MANAGEMENT */}
        {activeTab === 'proxies' && (
          <div className="space-y-6">
            {/* Sub-tab Navigation Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
                <button
                  onClick={() => setProxySubTab('my_proxies')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    proxySubTab === 'my_proxies'
                      ? 'bg-white dark:bg-card text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Server className="h-3.5 w-3.5" />
                  <span>{t('myProxies')} ({proxies.length})</span>
                </button>
                <button
                  onClick={() => setProxySubTab('official_market')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    proxySubTab === 'official_market'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5 text-amber-300" />
                  <span>🏢 {t('market')} ({officialProxies.length})</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400 text-amber-950 font-bold">{t('noOwn')}</span>
                </button>
                {isPlatformAdmin && (
                <button
                  onClick={() => setProxySubTab('admin_manage')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    proxySubTab === 'admin_manage'
                      ? 'bg-slate-900 text-amber-300 dark:bg-slate-700 shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                  <span>⚙️ {t('adminZone')}</span>
                </button>
                )}
              </div>

              {/* Quick Actions according to sub-tab */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchAllData()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-white dark:bg-card hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{t('refresh')}</span>
                </button>
                {proxySubTab === 'my_proxies' && (
                  <>
                    <button
                      onClick={() => setProxySubTab('official_market')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs hover:from-amber-600 hover:to-orange-600 transition-all"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      <span>🏢 {t('rentOfficial')}</span>
                    </button>
                    <button
                      onClick={() => setIsAddProxyOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{t('addOwnProxy')}</span>
                    </button>
                  </>
                )}
                {isPlatformAdmin && proxySubTab === 'admin_manage' && (
                  <button
                    onClick={() => setIsAddOfficialOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>➕ {t('adminAdd')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* ==================================================== */}
            {/* SUB-TAB 1: MY ACTIVE PROXIES (自用代理池)             */}
            {/* ==================================================== */}
            {proxySubTab === 'my_proxies' && (
              <div className="space-y-6">
                {/* Promo banner to rent official IP */}
                <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-violet-900 text-white rounded-2xl p-4 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-indigo-700/50">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-amber-300 shrink-0">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{t('promoQ')}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 font-extrabold uppercase">{t('official')}</span>
                      </div>
                      <p className="text-xs text-indigo-100 mt-0.5 max-w-2xl">
                        {t('promoDesc')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setProxySubTab('official_market')}
                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-xs shadow-sm transition-transform active:scale-95 shrink-0 flex items-center gap-1.5"
                  >
                    <Store className="h-4 w-4" />
                    <span>{t('browseMarket')}</span>
                  </button>
                </div>

                {/* Self-hosting Guide Card (Collapsed / Informative) */}
                <details className="group bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950/40 border border-blue-200 dark:border-indigo-900/60 rounded-2xl p-4 transition-all">
                  <summary className="font-bold text-xs text-blue-950 dark:text-blue-200 cursor-pointer flex items-center justify-between select-none">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-blue-600" />
                      <span>{t('ownGuideTitle')}</span>
                    </div>
                    <span className="text-xs text-blue-600 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="pt-3 space-y-2 text-xs text-blue-800 dark:text-blue-300 border-t border-blue-200/60 dark:border-indigo-900/60 mt-3">
                    <p>{t('ownGuideIntro')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      <div className="bg-white/80 dark:bg-card p-3 rounded-xl border border-blue-100 dark:border-border text-xs">
                        <span className="font-bold text-blue-700 dark:text-blue-400 block mb-1">{t('step1')}</span>
                        <span className="text-muted-foreground">{t('step1d')}</span>
                      </div>
                      <div className="bg-white/80 dark:bg-card p-3 rounded-xl border border-blue-100 dark:border-border text-xs">
                        <span className="font-bold text-blue-700 dark:text-blue-400 block mb-1">{t('step2')}</span>
                        <span className="text-muted-foreground">{t.rich('step2d', { code: c => <code>{c}</code> })}</span>
                      </div>
                      <div className="bg-white/80 dark:bg-card p-3 rounded-xl border border-blue-100 dark:border-border text-xs">
                        <span className="font-bold text-blue-700 dark:text-blue-400 block mb-1">{t('step3')}</span>
                        <span className="text-muted-foreground">{t('step3d')}</span>
                      </div>
                    </div>
                  </div>
                </details>

                {/* Proxy Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {proxies.map(proxy => {
                    const isTesting = testingProxyId === proxy.id
                    const isOfficial = proxy.source === 'official_leased'
                    const isHome = proxy.proxy_type === 'home_static'
                    const isMobile = proxy.proxy_type === 'mobile_4g'

                    return (
                      <div
                        key={proxy.id}
                        className={`bg-white dark:bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                          isOfficial
                            ? 'border-indigo-300 dark:border-indigo-700/80 bg-gradient-to-b from-indigo-50/40 to-transparent'
                            : 'border-border'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${proxy.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              <h4 className="font-bold text-sm text-foreground truncate" title={proxy.name}>{proxy.name}</h4>
                              {!isOfficial && (
                                <button
                                  onClick={() => handleOpenEditProxy(proxy)}
                                  title={t('editNameSettings')}
                                  className="p-1 text-xs text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded transition-colors shrink-0"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <span className={`text-[10px] shrink-0 font-bold px-2 py-0.5 rounded-full ${
                              isOfficial
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                : isHome
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : isMobile
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                            }`}>
                              {isOfficial ? t('kindOfficial') : isHome ? t('kindHome') : isMobile ? t('kindMobile') : t('kindBiz')}
                            </span>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl text-xs font-mono text-muted-foreground mb-3 space-y-1">
                            <div className="flex justify-between">
                              <span>{t('addrPort')}</span>
                              <span className="font-semibold text-foreground">{proxy.host}:{proxy.port}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{t('protocol')}</span>
                              <span className="uppercase font-semibold">{proxy.protocol}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{t('isp')}</span>
                              <span className="truncate max-w-[130px] font-medium text-foreground">{proxy.isp || t('nativeBb')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{t('location')}</span>
                              <span>{proxy.country} - {proxy.city || t('localNode')}</span>
                            </div>
                            {isOfficial && proxy.expires_at && (
                              <div className="flex justify-between text-indigo-600 dark:text-indigo-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                                <span>{t('leaseUntil')}</span>
                                <span>{new Date(proxy.expires_at).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>

                          {proxy.notes && (
                            <p className="text-[11px] text-muted-foreground mb-3 line-clamp-2 italic">
                              💡 {proxy.notes}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {t('latency')} <span className={proxy.latency_ms < 50 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>{proxy.latency_ms}ms</span>
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-muted-foreground">
                              {t('boundN', { n: proxy.assigned_count || 0 })}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {!isOfficial && (
                              <button
                                onClick={() => handleOpenEditProxy(proxy)}
                                title={t('editProxy')}
                                className="p-1.5 text-xs text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-md transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleTestProxy(proxy)}
                              disabled={isTesting}
                              title={t('speedTest')}
                              className="p-1.5 text-xs text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-md transition-colors"
                            >
                              <Activity className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin text-amber-500' : ''}`} />
                            </button>
                            {isOfficial ? (
                              <button
                                onClick={() => handleReleaseLease(proxy.lease_id || proxy.id)}
                                disabled={isReleasingId === (proxy.lease_id || proxy.id)}
                                title={t('releaseTitle')}
                                className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md transition-colors border border-rose-200 dark:border-rose-900"
                              >
                                {isReleasingId === (proxy.lease_id || proxy.id) ? t('processing') : t('release')}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDeleteProxy(proxy.id)}
                                title={t('deleteOwn')}
                                className="p-1.5 text-xs text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ==================================================== */}
            {/* SUB-TAB 2: OFFICIAL RENTABLE IP MARKET (官方租賃市場) */}
            {/* ==================================================== */}
            {proxySubTab === 'official_market' && (
              <div className="space-y-6">
                {leaseQuota && !isPlatformAdmin && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 px-4 py-3 text-sm">
                    <BadgeCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                      {t('quota', { quota: leaseQuota.quota, used: Math.min(leaseQuota.used, leaseQuota.quota) })}
                      {leaseQuota.used >= leaseQuota.quota && t('quotaExtra')}
                    </span>
                  </div>
                )}
                {/* Official Market Value Proposition Banner */}
                <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-violet-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-500/30">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
                        <BadgeCheck className="h-4 w-4" />
                        <span>{t('mktTag')}</span>
                      </div>
                      <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
                        {t('mktTitle')}
                      </h2>
                      <p className="text-indigo-100 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
                        {t('mktDesc1')}
                        {t('mktDesc2')}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15 shrink-0">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>{t('feat1')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>{t('feat2')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>{t('feat3')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>{t('feat4')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Official Rentable Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
                  {officialProxies.map(offProxy => {
                    const isLeasedByMe = proxies.some(
                      p => p.official_proxy_id === offProxy.id || (p.host === offProxy.host && p.port === offProxy.port)
                    )
                    const isAvailable = offProxy.status === 'available' && offProxy.current_tenants_count < offProxy.max_tenants
                    const isLeasing = isLeasingId === offProxy.id

                    return (
                      <div
                        key={offProxy.id}
                        className="bg-white dark:bg-card border border-border hover:border-indigo-300 dark:hover:border-indigo-700 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  offProxy.proxy_type === 'home_static'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                    : offProxy.proxy_type === 'mobile_4g'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                }`}>
                                  {offProxy.proxy_type === 'home_static' ? t('kindHomeBb') : offProxy.proxy_type === 'mobile_4g' ? t('kindMobile5g') : t('kindBiz')}
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground uppercase font-mono">
                                  {offProxy.protocol}
                                </span>
                              </div>
                              <h3 className="font-extrabold text-base text-foreground leading-tight">
                                {offProxy.name}
                              </h3>
                            </div>

                            {/* Status Badge */}
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 ${
                              isLeasedByMe
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200'
                                : isAvailable
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              <span className={`h-2 w-2 rounded-full ${isLeasedByMe ? 'bg-emerald-500' : isAvailable ? 'bg-indigo-500' : 'bg-slate-400'}`} />
                              {isLeasedByMe ? t('leasedByMe') : isAvailable ? t('available') : t('leasedOut')}
                            </span>
                          </div>

                          {/* Technical Highlights */}
                          <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl text-xs font-mono">
                            <div>
                              <span className="text-muted-foreground block text-[10px]">{t('carrier')}</span>
                              <span className="font-bold text-foreground truncate block">{offProxy.isp || t('twBb')}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px]">{t('nodeLoc')}</span>
                              <span className="font-bold text-foreground">{offProxy.country} - {offProxy.city || t('twLocal')}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px]">{t('latencyGrade')}</span>
                              <span className="font-bold text-emerald-600">{offProxy.latency_ms}ms ({t('lowLatency')})</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px]">{t('tenantQuota')}</span>
                              <span className="font-bold text-foreground">{t('oneTenant', { cur: offProxy.current_tenants_count, max: offProxy.max_tenants })}</span>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            💡 {offProxy.notes || t('offNoteDefault')}
                          </p>
                        </div>

                        {/* Pricing & CTA */}
                        <div className="pt-4 mt-3 border-t border-border flex items-center justify-between gap-4">
                          <div>
                            <span className="text-[10px] text-muted-foreground block">{t('leasePlan')}</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                                NT$ {offProxy.monthly_price_twd}
                              </span>
                              <span className="text-xs text-muted-foreground">{t('perMonth')}</span>
                            </div>
                            {creditsFor(offProxy.monthly_price_twd) != null && (
                              <span className="text-[11px] font-semibold text-muted-foreground">≈ {t('creditsPer30', { n: String(creditsFor(offProxy.monthly_price_twd) ?? '—') })}</span>
                            )}
                          </div>

                          <div>
                            {isLeasedByMe ? (
                              <button
                                onClick={() => setProxySubTab('my_proxies')}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                              >
                                <CheckCheck className="h-4 w-4" />
                                <span>{t('inPool')}</span>
                              </button>
                            ) : isAvailable ? (
                              <button
                                onClick={() => handleLeaseOfficial(offProxy)}
                                disabled={isLeasing}
                                className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white shadow-md hover:shadow-indigo-500/25 active:scale-95 transition-all disabled:opacity-50"
                              >
                                <Zap className={`h-4 w-4 text-amber-300 ${isLeasing ? 'animate-spin' : ''}`} />
                                <span>{isLeasing ? t('activating') : hasFreeQuota ? t('claimFree') : t('rentWithCredits', { n: String(creditsFor(offProxy.monthly_price_twd) ?? '—') })}</span>
                              </button>
                            ) : (
                              <button
                                disabled
                                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-muted-foreground cursor-not-allowed"
                              >
                                {t('full')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ==================================================== */}
            {/* SUB-TAB 3: ADMIN INVENTORY MANAGEMENT (管理者後台)    */}
            {/* ==================================================== */}
            {isPlatformAdmin && proxySubTab === 'admin_manage' && (
              <div className="space-y-6">
                {/* Admin Header */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm border border-slate-700">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                        <ShieldCheck className="h-4 w-4" />
                        <span>{t('adminPortal')}</span>
                      </div>
                      <h3 className="text-lg font-bold">
                        {t('adminTitle')}
                      </h3>
                      <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                        {t('adminDesc')}
                      </p>
                    </div>

                    <button
                      onClick={() => setIsAddOfficialOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md transition-all active:scale-95 shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                      <span>➕ {t('adminAdd')}</span>
                    </button>
                  </div>
                </div>

                {/* Inventory Table */}
                <div className="bg-white dark:bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm">{t('invList')}</h4>
                      <span className="text-xs text-muted-foreground">{t('invCount', { n: officialProxies.length })}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 text-muted-foreground border-b border-border font-bold">
                        <tr>
                          <th className="px-4 py-3">{t('thName')}</th>
                          <th className="px-4 py-3">{t('thHost')}</th>
                          <th className="px-4 py-3">{t('thProto')}</th>
                          <th className="px-4 py-3">{t('thIsp')}</th>
                          <th className="px-4 py-3">{t('thPrice')}</th>
                          <th className="px-4 py-3">{t('thQuota')}</th>
                          <th className="px-4 py-3">{t('thStatus')}</th>
                          <th className="px-4 py-3 text-right">{t('thActions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {officialProxies.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-bold text-foreground">{p.name}</div>
                              <span className="text-[10px] text-muted-foreground">
                                {p.proxy_type === 'home_static' ? t('kHome') : p.proxy_type === 'mobile_4g' ? t('kMobile') : t('kBiz')}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono">
                              <span className="font-semibold text-foreground">{p.host}:{p.port}</span>
                              {p.username && <span className="text-[10px] text-muted-foreground block">{t('userLabel', { name: p.username })}</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="uppercase font-semibold block">{p.protocol}</span>
                              <span className="text-[10px] text-emerald-600 font-bold">{p.latency_ms}ms</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-medium text-foreground block">{p.isp || t('nativeBb')}</span>
                              <span className="text-[10px] text-muted-foreground">{p.country} - {p.city || t('local')}</span>
                            </td>
                            <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">
                              NT$ {p.monthly_price_twd}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono font-semibold">
                                {p.current_tenants_count} / {p.max_tenants}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                p.status === 'available'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : p.status === 'rented_out'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}>
                                {p.status === 'available' ? t('stAvail') : p.status === 'rented_out' ? t('stRented') : t('stMaint')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleOpenEditOfficial(p)}
                                  title={t('editPricing')}
                                  className="p-1.5 text-xs text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-md transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteOfficialProxy(p.id)}
                                  title={t('unlistDelete')}
                                  className="p-1.5 text-xs text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}


        {/* TAB 2: ACCOUNTS MATRIX & AUTO WARM-UP */}
        {activeTab === 'accounts' && (
          <div className="space-y-6">
            {/* 14-Day Warm-up Workflow Banner */}
            <div className="bg-white dark:bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    <span>{t('warmTitle')}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('warmDesc')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRunWarmup()}
                    disabled={isWarmingUp}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Play className={`h-3.5 w-3.5 ${isWarmingUp ? 'animate-spin' : ''}`} />
                    <span>{isWarmingUp ? t('warming') : t('warmAll')}</span>
                  </button>
                  <button
                    onClick={() => setIsAddAccountOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('addAcc')}</span>
                  </button>
                </div>
              </div>

              {/* 4 Phases Timeline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>{t('ph1')}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded">Day 1-3</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t('ph1d')}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>{t('ph2')}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded">Day 4-7</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t('ph2d')}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>{t('ph3')}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded">Day 8-11</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t('ph3d')}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                    <span>{t('ph4')}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">Day 12-14+</span>
                  </div>
                  <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed font-medium">
                    {t('ph4d')}
                  </p>
                </div>
              </div>
            </div>

            {/* Accounts Grid */}
            <div>
              <h4 className="font-bold text-sm mb-3">{t('accMonitor')} ({accounts.length})</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map(acc => {
                  const isMature = acc.status === 'mature' || acc.warmup_day >= 12
                  return (
                    <div
                      key={acc.id}
                      className="bg-white dark:bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-border flex items-center justify-center font-bold text-sm text-indigo-600 uppercase">
                              {acc.platform.slice(0, 2)}
                            </div>
                            <div>
                              <h5 className="font-bold text-sm text-foreground">{acc.account_name}</h5>
                              <p className="text-xs text-muted-foreground font-mono">{acc.account_handle || `@${acc.platform}_user`}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isMature
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {isMature ? t('mature') : t('warmDay', { n: acc.warmup_day })}
                          </span>
                        </div>

                        {/* Health Bar */}
                        <div className="space-y-1 mb-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{t('accHealth')}</span>
                            <span className="font-bold text-indigo-600">{acc.health_score}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${
                                acc.health_score >= 85
                                  ? 'bg-emerald-500'
                                  : acc.health_score >= 70
                                  ? 'bg-blue-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${acc.health_score}%` }}
                            />
                          </div>
                        </div>

                        {/* Sticky Proxy Binding */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg text-xs space-y-1 mb-3 border border-slate-100 dark:border-slate-800">
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Lock className="h-3 w-3 text-indigo-500" />
                              {t('boundProxy')}
                            </span>
                            <span className="font-mono text-foreground font-medium truncate max-w-[130px]">
                              {acc.proxy?.name || t('defaultProxyName')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>{t('todayTasks')}</span>
                            <span className="text-foreground">{t('times', { a: acc.daily_actions_count || 1, b: acc.max_daily_actions || 5 })}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                        <button
                          onClick={() => handleRunWarmup(acc.id)}
                          disabled={isWarmingUp}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-medium transition-colors"
                        >
                          <Play className="h-3 w-3" />
                          <span>{t('runToday')}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="p-1 text-muted-foreground hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Live Terminal Warm-up Logs */}
            <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 font-mono text-xs shadow-lg border border-slate-800">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                  <span className="font-bold text-slate-100">{t('liveLog')}</span>
                </div>
                <span className="text-[10px] text-slate-400">{t('keepN', { n: logs.length })}</span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
                {logs.map(log => (
                  <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-500 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                    <span className="text-indigo-400 shrink-0 font-semibold">{log.account_name || t('account')}:</span>
                    <span className="text-slate-300">{log.details}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CAMPAIGN DISPATCH (MODE A + B) */}
        {activeTab === 'campaign' && (
          <div className="space-y-6">
            {/* Input Config Card */}
            <div className="bg-white dark:bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-bold text-base">{t('campTitle')}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t('quickSample')}</span>
                  <button
                    onClick={() => {
                      setIndustry(t('s1.industry'))
                      setCoreProduct(t('s1.product'))
                      setTargetAudience(t('s1.audience'))
                      setOffer(t('s1.offer'))
                      setCtaLink(t('s1.cta'))
                    }}
                    className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    {t('sample1')}
                  </button>
                  <button
                    onClick={() => {
                      setIndustry(t('s2.industry'))
                      setCoreProduct(t('s2.product'))
                      setTargetAudience(t('s2.audience'))
                      setOffer(t('s2.offer'))
                      setCtaLink(t('s2.cta'))
                    }}
                    className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    {t('sample2')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fIndustry')}</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    placeholder={t('fIndustryPh')}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fProduct')}</label>
                  <input
                    type="text"
                    value={coreProduct}
                    onChange={e => setCoreProduct(e.target.value)}
                    placeholder={t('fProductPh')}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fAudience')}</label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={e => setTargetAudience(e.target.value)}
                    placeholder={t('fAudiencePh')}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fOffer')}</label>
                  <input
                    type="text"
                    value={offer}
                    onChange={e => setOffer(e.target.value)}
                    placeholder={t('fOfferPh')}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="font-bold text-foreground block mb-1">{t('fCta')}</label>
                  <input
                    type="text"
                    value={ctaLink}
                    onChange={e => setCtaLink(e.target.value)}
                    placeholder={t('fCtaPh')}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Target Platforms Multi-Select */}
              <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">{t('targetPlatforms')}</span>
                  {(['facebook', 'threads', 'dcard', 'instagram', 'tiktok', 'x'] as SocialPlatform[]).map(plat => {
                    const isSelected = selectedPlatforms.includes(plat)
                    return (
                      <button
                        key={plat}
                        type="button"
                        onClick={() => {
                          setSelectedPlatforms(prev =>
                            prev.includes(plat) ? prev.filter(p => p !== plat) : [...prev, plat]
                          )
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {plat.toUpperCase()}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={handleGenerateCampaign}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:opacity-95 text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? t('generating') : t('startRadar')}</span>
                </button>
              </div>
            </div>

            {/* Generated Results Area */}
            {copies.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Col: Target Groups Radar (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-indigo-600" />
                        <span>{t('radar')} ({targetGroups.length})</span>
                      </h4>
                      <span className="text-[10px] text-muted-foreground">{t('radarSub')}</span>
                    </div>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                      {targetGroups.map((group, idx) => {
                        const selectedCopy = copies.find(c => c.id === selectedCopyId) || copies[0]
                        return (
                          <div
                            key={group.id || idx}
                            className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs space-y-2 hover:border-indigo-300 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-bold text-foreground text-xs block">{group.name}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">{group.platform.toUpperCase()} · {group.members_count}</span>
                              </div>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                group.strictness === 'high'
                                  ? 'bg-rose-100 text-rose-700'
                                  : group.strictness === 'medium'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {group.strictness === 'high' ? t('strictHigh') : group.strictness === 'medium' ? t('strictMed') : t('strictLow')}
                              </span>
                            </div>

                            <p className="text-[11px] text-indigo-900 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 p-2 rounded-lg">
                              💡 <strong>{t('strategy')}</strong>{group.recommended_strategy}
                            </p>

                            <div className="flex items-center justify-between pt-1">
                              <a
                                href={group.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-muted-foreground hover:text-indigo-600 flex items-center gap-1"
                              >
                                <span>{t('previewGroup')}</span>
                                <ArrowUpRight className="h-3 w-3" />
                              </a>

                              {/* Mode A Trigger Button */}
                              <button
                                onClick={() => handleDispatchModeA(group, selectedCopy)}
                                disabled={isDispatching}
                                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition-all"
                              >
                                <Send className="h-3 w-3" />
                                <span>{t('planAPost')}</span>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Col: Anti-Ban Varied Copies Matrix (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-border">
                      <div>
                        <h4 className="font-bold text-sm flex items-center gap-2">
                          <Layers className="h-4 w-4 text-indigo-600" />
                          <span>{t('copyLib', { n: copies.length })}</span>
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {t('copyLibDesc')}
                        </p>
                      </div>

                      {/* Mode B Master Launcher */}
                      <button
                        onClick={handleDispatchModeB}
                        disabled={isDispatching}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Zap className="h-3.5 w-3.5 text-amber-300" />
                        <span>{t('planB')}</span>
                      </button>
                    </div>

                    {/* Copy Variant Selector Tabs */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {copies.map(copy => {
                        const isActive = selectedCopyId === copy.id
                        return (
                          <button
                            key={copy.id}
                            onClick={() => setSelectedCopyId(copy.id)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                              isActive
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {copy.angle}
                          </button>
                        )
                      })}
                    </div>

                    {/* Active Selected Copy Card */}
                    {(() => {
                      const activeCopy = copies.find(c => c.id === selectedCopyId) || copies[0]
                      if (!activeCopy) return null

                      return (
                        <div className="space-y-3">
                          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                📌 {activeCopy.angle}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-border">
                                  {t('hash')} {activeCopy.anti_collision_hash}
                                </span>
                                <button
                                  onClick={() => handleCopy(`${activeCopy.title}\n\n${activeCopy.content}\n\n${activeCopy.hashtags.join(' ')}`, activeCopy.id)}
                                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors"
                                >
                                  {copiedId === activeCopy.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                  <span>{copiedId === activeCopy.id ? t('copiedShort') : t('copyAll')}</span>
                                </button>
                              </div>
                            </div>

                            <h5 className="font-extrabold text-sm text-foreground mb-2 leading-snug">
                              {activeCopy.title}
                            </h5>

                            <div className="text-xs text-foreground whitespace-pre-line leading-relaxed font-sans bg-white dark:bg-card p-3 rounded-lg border border-border">
                              {activeCopy.content}
                            </div>

                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {activeCopy.hashtags.map((tag, tIdx) => (
                                <span key={tIdx} className="text-[11px] text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full font-medium">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Mode A vs Mode B Guide Card */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
                              <span className="font-bold text-blue-900 dark:text-blue-300 block mb-1">
                                🔹 {t('planAMode')}
                              </span>
                              <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                                {t('planAModeDesc')}
                              </p>
                            </div>
                            <div className="p-3 rounded-xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50">
                              <span className="font-bold text-purple-900 dark:text-purple-300 block mb-1">
                                🔹 {t('planB')}
                              </span>
                              <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80 leading-relaxed">
                                {t('planBDesc')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </div>

      {/* MODAL: ADD PROXY */}
      {isAddProxyOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Server className="h-5 w-5 text-indigo-600" />
                <span>{t('addNode')}</span>
              </h3>
              <button onClick={() => setIsAddProxyOpen(false)} className="text-muted-foreground hover:text-foreground text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProxy} className="space-y-3 text-xs">
              <div className="flex items-center gap-4 py-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={!newProxyForm.isBatch}
                    onChange={() => setNewProxyForm(p => ({ ...p, isBatch: false }))}
                  />
                  <span>{t('single')}</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={newProxyForm.isBatch}
                    onChange={() => setNewProxyForm(p => ({ ...p, isBatch: true }))}
                  />
                  <span>{t('bulk')}</span>
                </label>
              </div>

              {newProxyForm.isBatch ? (
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('pasteList')}</label>
                  <textarea
                    rows={6}
                    value={newProxyForm.batchText}
                    onChange={e => setNewProxyForm(p => ({ ...p, batchText: e.target.value }))}
                    placeholder={`103.152.112.45:28899:user1:pass1\n211.75.142.88:28899\ntw.proxy.com:1234:user2:pass2`}
                    className="w-full px-3 py-2 rounded-lg border border-border font-mono bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-foreground block mb-1">{t('nodeName')}</label>
                      <input
                        type="text"
                        value={newProxyForm.name}
                        onChange={e => setNewProxyForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">{t('proxyType')}</label>
                      <select
                        value={newProxyForm.proxy_type}
                        onChange={e => setNewProxyForm(p => ({ ...p, proxy_type: e.target.value as ProxyType }))}
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                      >
                        <option value="home_static">{t('optHome')}</option>
                        <option value="residential">{t('optResi')}</option>
                        <option value="mobile_4g">{t('optMobile')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="font-bold text-foreground block mb-1">{t('fHost')}</label>
                      <input
                        type="text"
                        value={newProxyForm.host}
                        onChange={e => setNewProxyForm(p => ({ ...p, host: e.target.value }))}
                        placeholder={t('hostPh')}
                        required
                        className="w-full px-3 py-1.5 rounded-lg border border-border font-mono bg-background"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">{t('fPort')}</label>
                      <input
                        type="number"
                        value={newProxyForm.port}
                        onChange={e => setNewProxyForm(p => ({ ...p, port: Number(e.target.value) }))}
                        placeholder="28899"
                        required
                        className="w-full px-3 py-1.5 rounded-lg border border-border font-mono bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-foreground block mb-1">{t('fUser')}</label>
                      <input
                        type="text"
                        value={newProxyForm.username}
                        onChange={e => setNewProxyForm(p => ({ ...p, username: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">{t('fPass')}</label>
                      <input
                        type="password"
                        value={newProxyForm.password}
                        onChange={e => setNewProxyForm(p => ({ ...p, password: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-foreground block mb-1">{t('fCountry')}</label>
                      <input
                        type="text"
                        value={newProxyForm.country}
                        onChange={e => setNewProxyForm(p => ({ ...p, country: e.target.value }))}
                        placeholder="TW"
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">{t('fCity')}</label>
                      <input
                        type="text"
                        value={newProxyForm.city}
                        onChange={e => setNewProxyForm(p => ({ ...p, city: e.target.value }))}
                        placeholder={t('cityPh')}
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">{t('fIsp')}</label>
                      <input
                        type="text"
                        value={newProxyForm.isp}
                        onChange={e => setNewProxyForm(p => ({ ...p, isp: e.target.value }))}
                        placeholder={t('ispPh')}
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddProxyOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-slate-100 text-xs"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm"
                >
                  {t('confirmAdd')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PROXY */}
      {isEditProxyOpen && editingProxy && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Pencil className="h-5 w-5 text-indigo-600" />
                <span>{t('editNode')}</span>
              </h3>
              <button onClick={() => setIsEditProxyOpen(false)} className="text-muted-foreground hover:text-foreground text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProxy} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="font-bold text-foreground block mb-1">
                    {t('fAlias')} <span className="text-[10px] text-indigo-600 font-normal">{t('fAliasHint')}</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProxy.name}
                    onChange={e => setEditingProxy({ ...editingProxy, name: e.target.value })}
                    placeholder={t('aliasPh')}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('proxyType')}</label>
                  <select
                    value={editingProxy.proxy_type}
                    onChange={e => setEditingProxy({ ...editingProxy, proxy_type: e.target.value as ProxyType })}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  >
                    <option value="home_static">{t('optHome')}</option>
                    <option value="residential">{t('optResi')}</option>
                    <option value="mobile_4g">{t('optMobile')}</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fProtocol')}</label>
                  <select
                    value={editingProxy.protocol}
                    onChange={e => setEditingProxy({ ...editingProxy, protocol: e.target.value as ProxyProtocol })}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background uppercase"
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                    <option value="socks5">SOCKS5</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="font-bold text-foreground block mb-1">{t('fHost')}</label>
                  <input
                    type="text"
                    required
                    value={editingProxy.host}
                    onChange={e => setEditingProxy({ ...editingProxy, host: e.target.value })}
                    placeholder={t('hostPh2')}
                    className="w-full px-3 py-1.5 rounded-lg border border-border font-mono bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fPort')}</label>
                  <input
                    type="number"
                    required
                    value={editingProxy.port}
                    onChange={e => setEditingProxy({ ...editingProxy, port: Number(e.target.value) })}
                    placeholder="28899"
                    className="w-full px-3 py-1.5 rounded-lg border border-border font-mono bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fUser')}</label>
                  <input
                    type="text"
                    value={editingProxy.username || ''}
                    onChange={e => setEditingProxy({ ...editingProxy, username: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fPass')}</label>
                  <input
                    type="password"
                    value={editingProxy.password || ''}
                    onChange={e => setEditingProxy({ ...editingProxy, password: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fCountry')}</label>
                  <input
                    type="text"
                    value={editingProxy.country || 'TW'}
                    onChange={e => setEditingProxy({ ...editingProxy, country: e.target.value })}
                    placeholder="TW"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fCity')}</label>
                  <input
                    type="text"
                    value={editingProxy.city || ''}
                    onChange={e => setEditingProxy({ ...editingProxy, city: e.target.value })}
                    placeholder={t('cityPh')}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fIsp')}</label>
                  <input
                    type="text"
                    value={editingProxy.isp || ''}
                    onChange={e => setEditingProxy({ ...editingProxy, isp: e.target.value })}
                    placeholder={t('ispPh2')}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">{t('fNotes')}</label>
                <input
                  type="text"
                  value={editingProxy.notes || ''}
                  onChange={e => setEditingProxy({ ...editingProxy, notes: e.target.value })}
                  placeholder={t('notesPh')}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditProxyOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-slate-100 text-xs"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm"
                >
                  {t('saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD ACCOUNT */}
      {isAddAccountOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Cpu className="h-5 w-5 text-indigo-600" />
                <span>{t('addAccTitle')}</span>
              </h3>
              <button onClick={() => setIsAddAccountOpen(false)} className="text-muted-foreground hover:text-foreground text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">{t('fPlatform')}</label>
                <select
                  value={newAccountForm.platform}
                  onChange={e => setNewAccountForm(p => ({ ...p, platform: e.target.value as SocialPlatform }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                >
                  <option value="facebook">{t('optFb')}</option>
                  <option value="threads">{t('optThreads')}</option>
                  <option value="instagram">Instagram</option>
                  <option value="dcard">{t('optDcard')}</option>
                  <option value="tiktok">{t('optTiktok')}</option>
                  <option value="x">X (Twitter)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">{t('fAccName')}</label>
                <input
                  type="text"
                  value={newAccountForm.account_name}
                  onChange={e => setNewAccountForm(p => ({ ...p, account_name: e.target.value }))}
                  placeholder={t('accNamePh')}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">{t('fHandle')}</label>
                <input
                  type="text"
                  value={newAccountForm.account_handle}
                  onChange={e => setNewAccountForm(p => ({ ...p, account_handle: e.target.value }))}
                  placeholder="@danang_trip_pro"
                  className="w-full px-3 py-2 rounded-lg border border-border font-mono bg-background"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">{t('fBindProxy')}</label>
                <select
                  value={newAccountForm.proxy_id}
                  onChange={e => setNewAccountForm(p => ({ ...p, proxy_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono"
                >
                  <option value="">{t('pickNode')}</option>
                  {proxies.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.source === 'official_leased' ? t('srcOfficial') : t('srcOwn')}
                      {p.name} ({p.host}:{p.port})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">{t('fWarmDay')}</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={newAccountForm.warmup_day}
                  onChange={e => setNewAccountForm(p => ({ ...p, warmup_day: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  {t('warmDayHint')}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddAccountOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-slate-100 text-xs"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm"
                >
                  {t('addToMatrix')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN ADD OFFICIAL PROXY (管理者新增供租用 IP) */}
      {isAddOfficialOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    {t('adminAddTitle')}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {t('adminAddDesc')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddOfficialOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddOfficialProxy} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">
                  {t('fNodeLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={newOfficialForm.name}
                  onChange={e => setNewOfficialForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={t('nodeLabelPh')}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('proxyTypeReq')}</label>
                  <select
                    value={newOfficialForm.proxy_type}
                    onChange={e => setNewOfficialForm(p => ({ ...p, proxy_type: e.target.value as ProxyType }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  >
                    <option value="home_static">{t('optHome')}</option>
                    <option value="mobile_4g">{t('optMobileSim')}</option>
                    <option value="residential">{t('optResiBw')}</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fProtocolReq')}</label>
                  <select
                    value={newOfficialForm.protocol}
                    onChange={e => setNewOfficialForm(p => ({ ...p, protocol: e.target.value as ProxyProtocol }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background uppercase"
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                    <option value="socks5">SOCKS5</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="font-bold text-foreground block mb-1">{t('fHost')}</label>
                  <input
                    type="text"
                    required
                    value={newOfficialForm.host}
                    onChange={e => setNewOfficialForm(p => ({ ...p, host: e.target.value }))}
                    placeholder="211.75.142.99"
                    className="w-full px-3 py-1.5 rounded-lg border border-border font-mono bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fPort')}</label>
                  <input
                    type="number"
                    required
                    value={newOfficialForm.port}
                    onChange={e => setNewOfficialForm(p => ({ ...p, port: Number(e.target.value) }))}
                    placeholder="28899"
                    className="w-full px-3 py-1.5 rounded-lg border border-border font-mono bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fConnUser')}</label>
                  <input
                    type="text"
                    value={newOfficialForm.username}
                    onChange={e => setNewOfficialForm(p => ({ ...p, username: e.target.value }))}
                    placeholder="gate_admin"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fConnPass')}</label>
                  <input
                    type="password"
                    value={newOfficialForm.password}
                    onChange={e => setNewOfficialForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fIsp')}</label>
                  <input
                    type="text"
                    value={newOfficialForm.isp}
                    onChange={e => setNewOfficialForm(p => ({ ...p, isp: e.target.value }))}
                    placeholder={t('ispPh')}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fCountryCity')}</label>
                  <input
                    type="text"
                    value={newOfficialForm.city}
                    onChange={e => setNewOfficialForm(p => ({ ...p, city: e.target.value }))}
                    placeholder={t('cityPh3')}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fLatency')}</label>
                  <input
                    type="number"
                    value={newOfficialForm.latency_ms}
                    onChange={e => setNewOfficialForm(p => ({ ...p, latency_ms: Number(e.target.value) }))}
                    placeholder="18"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50">
                <div>
                  <label className="font-bold text-amber-900 dark:text-amber-300 block mb-1">
                    💰 {t('fPrice')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-muted-foreground font-bold">NT$</span>
                    <input
                      type="number"
                      required
                      value={newOfficialForm.monthly_price_twd}
                      onChange={e => setNewOfficialForm(p => ({ ...p, monthly_price_twd: Number(e.target.value) }))}
                      className="w-full pl-10 pr-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-background font-bold text-amber-700 dark:text-amber-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-bold text-amber-900 dark:text-amber-300 block mb-1">
                    🔒 {t('fMaxTenants')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={newOfficialForm.max_tenants}
                    onChange={e => setNewOfficialForm(p => ({ ...p, max_tenants: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-background font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">{t('fHighlights')}</label>
                <input
                  type="text"
                  value={newOfficialForm.notes}
                  onChange={e => setNewOfficialForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder={t('highlightsPh')}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddOfficialOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-slate-100 text-xs"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm"
                >
                  {t('confirmList')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN EDIT OFFICIAL PROXY (管理者編輯供租用 IP) */}
      {isEditOfficialOpen && editingOfficial && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Pencil className="h-5 w-5 text-amber-600" />
                <span>{t('adminEditTitle')}</span>
              </h3>
              <button
                onClick={() => setIsEditOfficialOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateOfficialProxy} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">{t('fNodeNameReq')}</label>
                <input
                  type="text"
                  required
                  value={editingOfficial.name}
                  onChange={e => setEditingOfficial({ ...editingOfficial, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="font-bold text-foreground block mb-1">{t('fHostShort')}</label>
                  <input
                    type="text"
                    required
                    value={editingOfficial.host}
                    onChange={e => setEditingOfficial({ ...editingOfficial, host: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-border font-mono bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fPort')}</label>
                  <input
                    type="number"
                    required
                    value={editingOfficial.port}
                    onChange={e => setEditingOfficial({ ...editingOfficial, port: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg border border-border font-mono bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fMonthly')}</label>
                  <input
                    type="number"
                    required
                    value={editingOfficial.monthly_price_twd}
                    onChange={e => setEditingOfficial({ ...editingOfficial, monthly_price_twd: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg border border-border font-bold text-indigo-600 bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fLeaseStatus')}</label>
                  <select
                    value={editingOfficial.status}
                    onChange={e => setEditingOfficial({ ...editingOfficial, status: e.target.value as OfficialProxyStatus })}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background font-medium"
                  >
                    <option value="available">{t('optAvail')}</option>
                    <option value="rented_out">{t('optRented')}</option>
                    <option value="maintenance">{t('optMaint')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fIsp')}</label>
                  <input
                    type="text"
                    value={editingOfficial.isp || ''}
                    onChange={e => setEditingOfficial({ ...editingOfficial, isp: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">{t('fCity')}</label>
                  <input
                    type="text"
                    value={editingOfficial.city || ''}
                    onChange={e => setEditingOfficial({ ...editingOfficial, city: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">{t('fFeatureNotes')}</label>
                <input
                  type="text"
                  value={editingOfficial.notes || ''}
                  onChange={e => setEditingOfficial({ ...editingOfficial, notes: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditOfficialOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-slate-100 text-xs"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm"
                >
                  {t('saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  )
}
