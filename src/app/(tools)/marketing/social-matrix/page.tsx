'use client'

import React, { useState, useEffect } from 'react'
import {
  Server, ShieldCheck, Activity, Plus, RefreshCw, Trash2, ExternalLink,
  Copy, Check, Sparkles, Send, Users, Layers, AlertCircle, Clock, Zap,
  CheckCircle2, Globe, Lock, Cpu, Play, Terminal, HelpCircle, ArrowUpRight,
  TrendingUp, Hash, MessageSquare, ShieldAlert, Pencil
} from 'lucide-react'
import {
  SocialProxy, SocialAccount, SocialLog, TargetGroup,
  MatrixCopy, ProxyType, ProxyProtocol, SocialPlatform
} from '@/lib/social-matrix/types'

export default function SocialMatrixPage() {
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
  const [industry, setIndustry] = useState('越南中越 (峴港/會安/巴拿山) 豪華包車與在地中文秘書服務')
  const [coreProduct, setCoreProduct] = useState('全新7-16人座商務車、雙語中文司機、機場快速通關接送、行程客製保險全包')
  const [targetAudience, setTargetAudience] = useState('台灣家庭出遊、自由行背包客、公司員旅與商務考察團')
  const [offer, setOffer] = useState('出發前14天預訂享早鳥 9 折，加贈全團越南 5G 吃到飽上網卡與私房海鮮餐廳折扣')
  const [ctaLink, setCtaLink] = useState('LINE 官方客服：@danang_tour 或 官網即時預約')
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
      const [pRes, aRes, lRes] = await Promise.all([
        fetch('/api/marketing/social-matrix/proxies').then(r => r.json()),
        fetch('/api/marketing/social-matrix/accounts').then(r => r.json()),
        fetch('/api/marketing/social-matrix/warmup').then(r => r.json()),
      ])

      let serverProxies: SocialProxy[] = pRes.proxies || []

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
    showToast('已成功複製到剪貼簿！', 'success')
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
      showToast(`測速失敗: ${String(err)}`, 'error')
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
        showToast('代理 IP 已成功加入代理池！', 'success')
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
        showToast(data.error || '新增失敗', 'error')
      }
    } catch (err) {
      showToast(String(err), 'error')
    }
  }

  const handleDeleteProxy = async (id: string) => {
    if (!confirm('確定要自代理池移除此代理 IP 嗎？')) return
    try {
      await fetch(`/api/marketing/social-matrix/proxies/${id}`, { method: 'DELETE' })
      setProxies(prev => {
        const next = prev.filter(p => p.id !== id)
        saveProxiesLocally(next)
        return next
      })
      showToast('已移除代理 IP', 'info')
    } catch (err) {
      showToast(`刪除失敗: ${String(err)}`, 'error')
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
        showToast('代理資訊與名稱已成功更新！', 'success')
        setIsEditProxyOpen(false)
        setProxies(prev => {
          const next = prev.map(p => p.id === editingProxy.id ? { ...p, ...editingProxy } : p)
          saveProxiesLocally(next)
          return next
        })
      } else {
        showToast(data.error || '更新失敗', 'error')
      }
    } catch (err) {
      showToast(`更新失敗: ${String(err)}`, 'error')
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
        showToast('新社群帳號已加入矩陣！', 'success')
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
        showToast(data.error || '新增失敗', 'error')
      }
    } catch (err) {
      showToast(String(err), 'error')
    }
  }

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('確定要移除此帳號嗎？')) return
    try {
      await fetch(`/api/marketing/social-matrix/accounts/${id}`, { method: 'DELETE' })
      setAccounts(prev => prev.filter(a => a.id !== id))
      showToast('已刪除社群帳號', 'info')
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
        showToast(`擬人化自動養號完成！已為 ${data.processed_count} 個帳號執行安全養成任務`, 'success')
        if (data.updated_accounts) setAccounts(data.updated_accounts)
        if (data.latest_logs) setLogs(data.latest_logs)
      } else {
        showToast(data.error || '養號執行失敗', 'error')
      }
    } catch (err) {
      showToast(`養號異常: ${String(err)}`, 'error')
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
        showToast(`AI 目標雷達已鎖定 ${data.target_groups?.length || 0} 個優質社群，並產出 ${data.copies?.length || 0} 組防封變異文案！`, 'success')
      } else {
        showToast(data.error || '生成失敗', 'error')
      }
    } catch (err) {
      showToast(`生成異常: ${String(err)}`, 'error')
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
        showToast(`方案 A 啟動成功！已複製防重文案，並已開啟 ${group.name} 發文頁面`, 'success')
        fetchAllData()
      }
    } catch (err) {
      showToast(`操作失敗: ${String(err)}`, 'error')
    } finally {
      setIsDispatching(false)
    }
  }

  // Dispatch Mode B (Matrix Auto Queue)
  const handleDispatchModeB = async () => {
    const selectedCopy = copies.find(c => c.id === selectedCopyId) || copies[0]
    if (!selectedCopy) {
      showToast('請先由上方生成防封文案矩陣', 'error')
      return
    }

    const matureCount = accounts.filter(a => a.status === 'mature' || a.warmup_day >= 12).length
    if (matureCount === 0) {
      showToast('目前尚無已完成 14 天擬人化養成 (Day 12+) 的成熟矩陣號！請先養號以保帳號安全', 'error')
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
        showToast(data.error || '發布失敗', 'error')
      }
    } catch (err) {
      showToast(`排程異常: ${String(err)}`, 'error')
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
                <span>AI GATE 社群矩陣與自動養號行銷系統</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                社群矩陣發文與擬人化養號中心
              </h1>
              <p className="text-indigo-100 text-sm mt-1 max-w-2xl">
                支援家用原生靜態住宅 IP、14 天擬人化漸進養號、方案 A（真人 Copilot）與方案 B（矩陣自動排程發布）、AI 社群雷達與防風控防重文案庫。
              </p>
            </div>

            {/* Quick Live Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15">
              <div className="px-3 py-1 text-center">
                <span className="text-[11px] text-indigo-200 block">代理池在線</span>
                <span className="text-lg font-bold text-white flex items-center justify-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  {activeProxiesCount}
                </span>
              </div>
              <div className="px-3 py-1 text-center border-l border-white/10">
                <span className="text-[11px] text-indigo-200 block">成熟矩陣號</span>
                <span className="text-lg font-bold text-emerald-300">{matureAccountsCount}</span>
              </div>
              <div className="px-3 py-1 text-center border-l border-white/10">
                <span className="text-[11px] text-indigo-200 block">養號中 (Day 1-11)</span>
                <span className="text-lg font-bold text-amber-300">{warmingAccountsCount}</span>
              </div>
              <div className="px-3 py-1 text-center border-l border-white/10">
                <span className="text-[11px] text-indigo-200 block">平均健康度</span>
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
              <span>🌐 代理池管理 ({proxies.length})</span>
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
              <span>🤖 帳號矩陣與自動養號 ({accounts.length})</span>
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
              <span>🚀 社群行銷發布 (方案 A + B)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* TAB 1: PROXIES MANAGEMENT */}
        {activeTab === 'proxies' && (
          <div className="space-y-6">
            {/* Guide Card: Home Native Static Residential IP */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950/40 border border-blue-200 dark:border-indigo-900/60 rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm shrink-0">
                  <Globe className="h-6 w-6" />
                </div>
                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-blue-950 dark:text-blue-200 flex items-center gap-2">
                      <span>聯禾有線電視 / 中華電信 家用原生靜態 IP 串接教學</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">抗封號最強首選 (A+)</span>
                    </h3>
                  </div>
                  <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                    家用原生寬頻為各大社群演算法（Meta/TikTok/Dcard）認定之最高信譽家用原生住宅 IP，完全零機房黑名單污染。按照以下三步即可直接串入系統：
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="bg-white/80 dark:bg-card p-3 rounded-xl border border-blue-100 dark:border-border text-xs">
                      <span className="font-bold text-blue-700 dark:text-blue-400 block mb-1">步驟 1：路由器轉發 Port</span>
                      <span className="text-muted-foreground">進入家中 Wi-Fi 路由器後台，設定 Port Forwarding（通訊埠轉發），將外網 Port (如 28899) 指向內網電腦/NAS/主機。</span>
                    </div>
                    <div className="bg-white/80 dark:bg-card p-3 rounded-xl border border-blue-100 dark:border-border text-xs">
                      <span className="font-bold text-blue-700 dark:text-blue-400 block mb-1">步驟 2：本機啟動 Proxy 服務</span>
                      <span className="text-muted-foreground">電腦安裝輕量代理服務（如 <code>gost -L=http://帳號:密碼@:28899</code> 或 3proxy），並設定帳密防護。</span>
                    </div>
                    <div className="bg-white/80 dark:bg-card p-3 rounded-xl border border-blue-100 dark:border-border text-xs">
                      <span className="font-bold text-blue-700 dark:text-blue-400 block mb-1">步驟 3：後台填入並綁定帳號</span>
                      <span className="text-muted-foreground">點擊下方「新增代理 IP」，輸入家中靜態 IP (如 211.75.xx.xx) 與 28899，完成測速後即可將主號固定綁定！</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">已配置代理 IP 清單</h2>
                <span className="text-xs text-muted-foreground">（共 {proxies.length} 個獨立住宅/商用節點）</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchAllData()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-white dark:bg-card hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>重新整理</span>
                </button>
                <button
                  onClick={() => setIsAddProxyOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>新增代理 IP</span>
                </button>
              </div>
            </div>

            {/* Proxy Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {proxies.map(proxy => {
                const isTesting = testingProxyId === proxy.id
                const isHome = proxy.proxy_type === 'home_static'
                return (
                  <div
                    key={proxy.id}
                    className="bg-white dark:bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${proxy.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <h4 className="font-bold text-sm text-foreground truncate" title={proxy.name}>{proxy.name}</h4>
                          <button
                            onClick={() => handleOpenEditProxy(proxy)}
                            title="修改名稱與設定"
                            className="p-1 text-xs text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded transition-colors shrink-0"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                        <span className={`text-[10px] shrink-0 font-semibold px-2 py-0.5 rounded-full ${
                          isHome
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                        }`}>
                          {isHome ? '🏠 家用原生靜態' : '🏢 商業住宅代理'}
                        </span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg text-xs font-mono text-muted-foreground mb-3 space-y-1">
                        <div className="flex justify-between">
                          <span>位址與端口:</span>
                          <span className="font-semibold text-foreground">{proxy.host}:{proxy.port}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>通訊協議:</span>
                          <span className="uppercase">{proxy.protocol}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>所屬 ISP:</span>
                          <span className="truncate max-w-[130px]">{proxy.isp || '台灣原生寬頻'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>地理位置:</span>
                          <span>{proxy.country} - {proxy.city || '台灣在地'}</span>
                        </div>
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
                          延遲: <span className={proxy.latency_ms < 50 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>{proxy.latency_ms}ms</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-muted-foreground">
                          綁定 {proxy.assigned_count || 0} 帳號
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditProxy(proxy)}
                          title="編輯代理名稱與設定"
                          className="p-1.5 text-xs text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-md transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleTestProxy(proxy)}
                          disabled={isTesting}
                          title="一鍵連線測速"
                          className="p-1.5 text-xs text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-md transition-colors"
                        >
                          <Activity className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin text-amber-500' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleDeleteProxy(proxy.id)}
                          title="刪除代理"
                          className="p-1.5 text-xs text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
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
                    <span>AI 擬人化 14 天漸進式養號進程</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    社群演算法會高度監控新帳號的前兩週行為。系統透過每日獨立住宅 IP + 模擬真人滾動瀏覽與社交互動，防封號率高達 99.4%。
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRunWarmup()}
                    disabled={isWarmingUp}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Play className={`h-3.5 w-3.5 ${isWarmingUp ? 'animate-spin' : ''}`} />
                    <span>{isWarmingUp ? 'AI 養號任務執行中...' : '⚡ 一鍵執行全體今日擬人養號'}</span>
                  </button>
                  <button
                    onClick={() => setIsAddAccountOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>新增矩陣帳號</span>
                  </button>
                </div>
              </div>

              {/* 4 Phases Timeline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>階段一：靜默潛伏期</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded">Day 1-3</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    登入隨機瀏覽 15-30 分鐘，累積設備指紋，完全零發文零私訊，避開新號雷達。
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>階段二：輕度互動期</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded">Day 4-7</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    瀏覽同業話題，對 3~5 則貼文按讚、關注官方優質粉專、觀看影片，建立真人興趣特徵。
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>階段三：社交融入期</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded">Day 8-11</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    加入目標社群/板塊，AI 自動生成正向心得留言 1 則，自然融入討論，權重飆升。
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                    <span>階段四：成熟發布期</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">Day 12-14+</span>
                  </div>
                  <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed font-medium">
                    健康度達 85% 以上，正式解鎖方案 A (Copilot) 與方案 B (自動發布) 矩陣行銷能力！
                  </p>
                </div>
              </div>
            </div>

            {/* Accounts Grid */}
            <div>
              <h4 className="font-bold text-sm mb-3">矩陣帳號監控 ({accounts.length})</h4>
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
                            {isMature ? '成熟可用' : `養號 Day ${acc.warmup_day}`}
                          </span>
                        </div>

                        {/* Health Bar */}
                        <div className="space-y-1 mb-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">帳號健康度:</span>
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
                              固定綁定代理:
                            </span>
                            <span className="font-mono text-foreground font-medium truncate max-w-[130px]">
                              {acc.proxy?.name || '宜蘭聯禾原生 IP'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>今日互動任務:</span>
                            <span className="text-foreground">{acc.daily_actions_count || 1} / {acc.max_daily_actions || 5} 次</span>
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
                          <span>執行今日養號</span>
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
                  <span className="font-bold text-slate-100">擬人化養號與防封號行為即時日誌 (Live Warm-up Terminal)</span>
                </div>
                <span className="text-[10px] text-slate-400">保留最新 {logs.length} 筆</span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
                {logs.map(log => (
                  <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-500 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                    <span className="text-indigo-400 shrink-0 font-semibold">{log.account_name || '帳號'}:</span>
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
                  <h3 className="font-bold text-base">廣告標的、產業動態輸入與設定</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">快速帶入範例：</span>
                  <button
                    onClick={() => {
                      setIndustry('越南中越 (峴港/會安/巴拿山) 豪華包車與在地中文秘書服務')
                      setCoreProduct('全新7-16人座商務車、雙語中文司機、機場快速通關接送、行程客製保險全包')
                      setTargetAudience('台灣家庭出遊、自由行背包客、公司員旅與商務考察團')
                      setOffer('出發前14天預訂享早鳥 9 折，加贈全團越南 5G 吃到飽上網卡與私房海鮮餐廳折扣')
                      setCtaLink('LINE 官方客服：@danang_tour 或 官網即時預約')
                    }}
                    className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    🌴 越南峴港包車
                  </button>
                  <button
                    onClick={() => {
                      setIndustry('宜蘭礁溪溫泉包棟親子特色民宿')
                      setCoreProduct('獨棟日式庭院、私人冷熱雙泉、電動麻將桌、兒童球池、烤肉庭院')
                      setTargetAudience('三代同堂家庭、好友聚會包棟、週末度假客')
                      setOffer('平日預訂贈送現採無毒蔬果早餐籃與礁溪在地溫泉伴手禮盒')
                      setCtaLink('官方 LINE 諮詢：@yilan_hotspring')
                    }}
                    className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    ♨️ 宜蘭溫泉包棟
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-foreground block mb-1">推廣產業 / 廣告標的 *</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    placeholder="例：越南峴港包車旅遊、宜蘭包棟民宿、女性韓系服飾..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">推廣核心產品與獨家賣點 *</label>
                  <input
                    type="text"
                    value={coreProduct}
                    onChange={e => setCoreProduct(e.target.value)}
                    placeholder="例：全新7人座、雙語司機、無隱形消費..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">目標客群受眾特徵</label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={e => setTargetAudience(e.target.value)}
                    placeholder="例：25-45歲家庭旅遊、自由行背包客、商務考察..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">促銷誘因 / 早鳥福利 (Hook)</label>
                  <input
                    type="text"
                    value={offer}
                    onChange={e => setOffer(e.target.value)}
                    placeholder="例：早鳥9折、贈送上網卡、免費行程諮詢..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="font-bold text-foreground block mb-1">行動呼籲 (CTA) / 導流連結 / LINE ID</label>
                  <input
                    type="text"
                    value={ctaLink}
                    onChange={e => setCtaLink(e.target.value)}
                    placeholder="例：LINE 官方帳號 @danang_tour、電話或預約網址..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Target Platforms Multi-Select */}
              <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">目標發行平台：</span>
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
                  <span>{isGenerating ? 'AI 雷達探勘與防封文案生成中...' : '🎯 啟動 AI 目標社團雷達 & 生成防封文案庫'}</span>
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
                        <span>AI 目標社團雷達 ({targetGroups.length})</span>
                      </h4>
                      <span className="text-[10px] text-muted-foreground">精準流量池探勘</span>
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
                                {group.strictness === 'high' ? '嚴格審查' : group.strictness === 'medium' ? '中度審查' : '公開寬鬆'}
                              </span>
                            </div>

                            <p className="text-[11px] text-indigo-900 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 p-2 rounded-lg">
                              💡 <strong>建議發布策略：</strong>{group.recommended_strategy}
                            </p>

                            <div className="flex items-center justify-between pt-1">
                              <a
                                href={group.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-muted-foreground hover:text-indigo-600 flex items-center gap-1"
                              >
                                <span>前往社團預覽</span>
                                <ArrowUpRight className="h-3 w-3" />
                              </a>

                              {/* Mode A Trigger Button */}
                              <button
                                onClick={() => handleDispatchModeA(group, selectedCopy)}
                                disabled={isDispatching}
                                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition-all"
                              >
                                <Send className="h-3 w-3" />
                                <span>方案 A：真人發布 ↗</span>
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
                          <span>防封防重文案矩陣庫 ({copies.length} 組變異版本)</span>
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          每組採用不同受眾視角與非重複 Hash 指紋，杜絕平台文本比對風控。
                        </p>
                      </div>

                      {/* Mode B Master Launcher */}
                      <button
                        onClick={handleDispatchModeB}
                        disabled={isDispatching}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Zap className="h-3.5 w-3.5 text-amber-300" />
                        <span>方案 B：矩陣自動排程發布</span>
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
                                  防重 Hash: {activeCopy.anti_collision_hash}
                                </span>
                                <button
                                  onClick={() => handleCopy(`${activeCopy.title}\n\n${activeCopy.content}\n\n${activeCopy.hashtags.join(' ')}`, activeCopy.id)}
                                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors"
                                >
                                  {copiedId === activeCopy.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                  <span>{copiedId === activeCopy.id ? '已複製' : '一鍵複製全文'}</span>
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
                                🔹 方案 A：真人 Copilot 模式
                              </span>
                              <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                                由真人點擊左側社團清單的「方案 A：真人發布 ↗」，系統自動將防重文案帶入剪貼簿並開啟社團發文框，100% 零封號風險。
                              </p>
                            </div>
                            <div className="p-3 rounded-xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50">
                              <span className="font-bold text-purple-900 dark:text-purple-300 block mb-1">
                                🔹 方案 B：矩陣自動排程發布
                              </span>
                              <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80 leading-relaxed">
                                專屬已成熟 (Day 12+) 矩陣號，點擊上方按鈕後，自動將變異文案分配至不同帳號與獨立代理 IP，分批間隔無人值守發布。
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
                <span>新增代理 IP 節點</span>
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
                  <span>單一代理設定</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={newProxyForm.isBatch}
                    onChange={() => setNewProxyForm(p => ({ ...p, isBatch: true }))}
                  />
                  <span>多筆批次匯入 (ip:port:user:pass)</span>
                </label>
              </div>

              {newProxyForm.isBatch ? (
                <div>
                  <label className="font-bold text-foreground block mb-1">貼上代理清單 (每行一筆)：</label>
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
                      <label className="font-bold text-foreground block mb-1">節點名稱</label>
                      <input
                        type="text"
                        value={newProxyForm.name}
                        onChange={e => setNewProxyForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">代理類型</label>
                      <select
                        value={newProxyForm.proxy_type}
                        onChange={e => setNewProxyForm(p => ({ ...p, proxy_type: e.target.value as ProxyType }))}
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                      >
                        <option value="home_static">🏠 家用原生靜態 (聯禾/中華)</option>
                        <option value="residential">🏢 商業靜態住宅 (IPRoyal/Smartproxy)</option>
                        <option value="mobile_4g">📱 4G/5G 移動基站代理</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="font-bold text-foreground block mb-1">IP 位址 / 主機 Host *</label>
                      <input
                        type="text"
                        value={newProxyForm.host}
                        onChange={e => setNewProxyForm(p => ({ ...p, host: e.target.value }))}
                        placeholder="例：211.75.142.88"
                        required
                        className="w-full px-3 py-1.5 rounded-lg border border-border font-mono bg-background"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">端口 Port *</label>
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
                      <label className="font-bold text-foreground block mb-1">帳號 (選填)</label>
                      <input
                        type="text"
                        value={newProxyForm.username}
                        onChange={e => setNewProxyForm(p => ({ ...p, username: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">密碼 (選填)</label>
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
                      <label className="font-bold text-foreground block mb-1">國家代碼</label>
                      <input
                        type="text"
                        value={newProxyForm.country}
                        onChange={e => setNewProxyForm(p => ({ ...p, country: e.target.value }))}
                        placeholder="TW"
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">城市地區</label>
                      <input
                        type="text"
                        value={newProxyForm.city}
                        onChange={e => setNewProxyForm(p => ({ ...p, city: e.target.value }))}
                        placeholder="宜蘭 / 台北 / 峴港"
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">電信業者 ISP</label>
                      <input
                        type="text"
                        value={newProxyForm.isp}
                        onChange={e => setNewProxyForm(p => ({ ...p, isp: e.target.value }))}
                        placeholder="聯禾有線電視"
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
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm"
                >
                  確認新增
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
                <span>編輯代理節點資訊與名稱</span>
              </h3>
              <button onClick={() => setIsEditProxyOpen(false)} className="text-muted-foreground hover:text-foreground text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProxy} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="font-bold text-foreground block mb-1">
                    代理名稱 / 自訂標籤 * <span className="text-[10px] text-indigo-600 font-normal">（可自由更改，例如：我的 IPRoyal 代理、手機 4G 節點）</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProxy.name}
                    onChange={e => setEditingProxy({ ...editingProxy, name: e.target.value })}
                    placeholder="例：我的 IPRoyal 住宅代理"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">代理類型</label>
                  <select
                    value={editingProxy.proxy_type}
                    onChange={e => setEditingProxy({ ...editingProxy, proxy_type: e.target.value as ProxyType })}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  >
                    <option value="home_static">🏠 家用原生靜態 (聯禾/中華)</option>
                    <option value="residential">🏢 商業靜態住宅 (IPRoyal/Smartproxy)</option>
                    <option value="mobile_4g">📱 4G/5G 移動基站代理</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">通訊協議</label>
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
                  <label className="font-bold text-foreground block mb-1">IP 位址 / 主機 Host *</label>
                  <input
                    type="text"
                    required
                    value={editingProxy.host}
                    onChange={e => setEditingProxy({ ...editingProxy, host: e.target.value })}
                    placeholder="211.75.142.88 或 geo.iproyal.com"
                    className="w-full px-3 py-1.5 rounded-lg border border-border font-mono bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">端口 Port *</label>
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
                  <label className="font-bold text-foreground block mb-1">帳號 (選填)</label>
                  <input
                    type="text"
                    value={editingProxy.username || ''}
                    onChange={e => setEditingProxy({ ...editingProxy, username: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">密碼 (選填)</label>
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
                  <label className="font-bold text-foreground block mb-1">國家代碼</label>
                  <input
                    type="text"
                    value={editingProxy.country || 'TW'}
                    onChange={e => setEditingProxy({ ...editingProxy, country: e.target.value })}
                    placeholder="TW"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">城市地區</label>
                  <input
                    type="text"
                    value={editingProxy.city || ''}
                    onChange={e => setEditingProxy({ ...editingProxy, city: e.target.value })}
                    placeholder="宜蘭 / 台北 / 峴港"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">電信業者 ISP</label>
                  <input
                    type="text"
                    value={editingProxy.isp || ''}
                    onChange={e => setEditingProxy({ ...editingProxy, isp: e.target.value })}
                    placeholder="聯禾有線電視 / 中華電信"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">備註說明 (選填)</label>
                <input
                  type="text"
                  value={editingProxy.notes || ''}
                  onChange={e => setEditingProxy({ ...editingProxy, notes: e.target.value })}
                  placeholder="例：專用於發布 FB 社團主號"
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditProxyOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-slate-100 text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm"
                >
                  儲存修改
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
                <span>加入社群矩陣帳號</span>
              </h3>
              <button onClick={() => setIsAddAccountOpen(false)} className="text-muted-foreground hover:text-foreground text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">目標社群平台 *</label>
                <select
                  value={newAccountForm.platform}
                  onChange={e => setNewAccountForm(p => ({ ...p, platform: e.target.value as SocialPlatform }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                >
                  <option value="facebook">Facebook (社團/粉專/個人號)</option>
                  <option value="threads">Threads (脆)</option>
                  <option value="instagram">Instagram</option>
                  <option value="dcard">Dcard 看板</option>
                  <option value="tiktok">TikTok 短影音</option>
                  <option value="x">X (Twitter)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">帳號名稱 / 暱稱 *</label>
                <input
                  type="text"
                  value={newAccountForm.account_name}
                  onChange={e => setNewAccountForm(p => ({ ...p, account_name: e.target.value }))}
                  placeholder="例：峴港自由行達人-阿豪"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">帳號 Handle (帳號代稱)</label>
                <input
                  type="text"
                  value={newAccountForm.account_handle}
                  onChange={e => setNewAccountForm(p => ({ ...p, account_handle: e.target.value }))}
                  placeholder="@danang_trip_pro"
                  className="w-full px-3 py-2 rounded-lg border border-border font-mono bg-background"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">固定綁定代理 IP (防風控必選) *</label>
                <select
                  value={newAccountForm.proxy_id}
                  onChange={e => setNewAccountForm(p => ({ ...p, proxy_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono"
                >
                  <option value="">選擇代理池節點...</option>
                  {proxies.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.host}:{p.port})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">目前養成天數 (1 - 14 天)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={newAccountForm.warmup_day}
                  onChange={e => setNewAccountForm(p => ({ ...p, warmup_day: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  新號建議從 Day 1 循序漸進；若為既有使用許久的舊帳號可直接設定 Day 14 成熟期。
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddAccountOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-slate-100 text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm"
                >
                  加入矩陣
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
