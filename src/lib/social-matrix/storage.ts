import {
  SocialProxy,
  SocialAccount,
  SocialCampaign,
  SocialLog,
  TargetGroup,
  MatrixCopy,
  OfficialRentableProxy,
  ProxyLease,
} from './types'

// Pre-seeded AI-GATE Official Rentable IP Inventory (管理者維護的官方可租用代理庫存)
let globalOfficialProxies: OfficialRentableProxy[] = [
  {
    id: 'off-tw-yilan-01',
    name: '🇹🇼 台灣宜蘭聯禾原生住宅 IP #1 (A+ 級防封首選)',
    proxy_type: 'home_static',
    protocol: 'http',
    host: '211.75.142.88',
    port: 28899,
    username: 'gate_leased_01',
    password: '••••••••',
    country: 'TW',
    city: '宜蘭 (Yilan)',
    isp: '聯禾有線電視 (TBC 原生家用住宅寬頻)',
    latency_ms: 18,
    monthly_price_twd: 299,
    max_tenants: 1,
    current_tenants_count: 0,
    status: 'available',
    is_active: true,
    notes: '純天然家用寬頻原生固定 IP，權重極高，專屬獨立不撞車，最抗 Meta / IG / Threads 風控演算法',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: 'off-tw-cht-4g-01',
    name: '🇹🇼 中華電信 4G/5G 行動基站代理 #1 (S 級獨立行動 IP)',
    proxy_type: 'mobile_4g',
    protocol: 'socks5',
    host: 'cht-mobile-01.aigate.io',
    port: 31280,
    username: 'gate_cht_user',
    password: '••••••••',
    country: 'TW',
    city: '台北 (Taipei)',
    isp: '中華電信行動通信分公司 (Chunghwa 4G Mobile)',
    latency_ms: 25,
    monthly_price_twd: 399,
    max_tenants: 1,
    current_tenants_count: 0,
    status: 'available',
    is_active: true,
    notes: '真實 SIM 卡 4G 行動網路，天然擁有最高信任度行動設備指紋，適合 TikTok / Dcard 矩陣號養號',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
  },
  {
    id: 'off-tw-tfn-01',
    name: '🇹🇼 台灣固網商業住宅代理 #1 (台北商務高帶寬)',
    proxy_type: 'residential',
    protocol: 'http',
    host: 'tw-tfn-01.aigate.io',
    port: 10800,
    username: 'gate_tfn_user',
    password: '••••••••',
    country: 'TW',
    city: '台北 (Taipei)',
    isp: '台灣固網 (TFN Business Residential)',
    latency_ms: 22,
    monthly_price_twd: 249,
    max_tenants: 1,
    current_tenants_count: 0,
    status: 'available',
    is_active: true,
    notes: '高速穩定骨幹商業住宅 IP，適合大批量貼文發布與社群多帳號高頻排程',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'off-vn-viettel-01',
    name: '🇻🇳 越南峴港 Viettel 原生住宅代理 #1 (東南亞在地行銷)',
    proxy_type: 'residential',
    protocol: 'http',
    host: 'vn-danang-01.aigate.io',
    port: 10808,
    username: 'gate_viettel_danang',
    password: '••••••••',
    country: 'VN',
    city: '峴港 (Da Nang)',
    isp: 'Viettel Telecom (越南軍隊電信原生寬頻)',
    latency_ms: 62,
    monthly_price_twd: 199,
    max_tenants: 1,
    current_tenants_count: 0,
    status: 'available',
    is_active: true,
    notes: '越南當地原生住宅 IP，專為峴港/中越旅遊、包車接待、跨境海外行銷打造之在地節點',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  }
]

let globalLeases: ProxyLease[] = []

// In-memory persistent fallback store for current server lifecycle

let globalProxies: SocialProxy[] = [
  {
    id: 'proxy-user-iproyal',
    name: 'IPRoyal 台灣住宅代理',
    proxy_type: 'residential',
    protocol: 'http',
    host: 'geo.iproyal.com',
    port: 12321,
    username: '',
    password: '',
    country: 'TW',
    city: '宜蘭',
    isp: '台灣原生寬頻 (IPRoyal Residential)',
    status: 'active',
    latency_ms: 45,
    last_checked_at: new Date().toISOString(),
    notes: '使用者自訂設定之 IPRoyal 住宅代理',
    assigned_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'proxy-home-yilan',
    name: '宜蘭聯禾有線原生靜態住宅 IP (首選)',
    proxy_type: 'home_static',
    protocol: 'http',
    host: '211.75.142.88',
    port: 28899,
    username: 'gate_admin',
    password: '••••••••',
    country: 'TW',
    city: '宜蘭 (Yilan)',
    isp: '聯禾有線電視 (TBC Home ISP)',
    status: 'active',
    latency_ms: 18,
    last_checked_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    notes: '家用原生固定 IP，純天然住宅寬頻，權重極高，專屬綁定高價值主號，最抗演算法封號',
    assigned_count: 2,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: 'proxy-res-tw-01',
    name: 'IPRoyal 台灣靜態住宅代理 #1',
    proxy_type: 'residential',
    protocol: 'socks5',
    host: 'tw.residential.iproyal.com',
    port: 12321,
    username: 'ipr_user_98',
    password: '••••••••',
    country: 'TW',
    city: '台北 (Taipei)',
    isp: 'Chunghwa Telecom (中華電信住宅)',
    status: 'active',
    latency_ms: 42,
    last_checked_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    notes: '商業靜態住宅代理，用於 Dcard 與 X 矩陣帳號養號',
    assigned_count: 2,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'proxy-res-vn-01',
    name: 'Smartproxy 越南靜態住宅代理 (峴港)',
    proxy_type: 'residential',
    protocol: 'http',
    host: 'vn.smartproxy.com',
    port: 10001,
    username: 'sp_danang_vip',
    password: '••••••••',
    country: 'VN',
    city: '峴港 (Da Nang)',
    isp: 'Viettel Telecom (越南軍隊電信原生住宅)',
    status: 'active',
    latency_ms: 65,
    last_checked_at: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    notes: '越南當地原生住宅 IP，專門用於越南旅遊/包車/商務在地社群行銷',
    assigned_count: 2,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  }
]

let globalAccounts: SocialAccount[] = [
  {
    id: 'acc-fb-01',
    platform: 'facebook',
    account_name: '旅遊行家-小陳 (主號)',
    account_handle: '@chen_travel_tw',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    proxy_id: 'proxy-home-yilan',
    warmup_day: 14,
    status: 'mature',
    health_score: 96,
    daily_actions_count: 3,
    max_daily_actions: 5,
    target_niches: ['台灣旅遊', '越南包車', '自由行攻略'],
    last_action_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
  },
  {
    id: 'acc-ig-01',
    platform: 'instagram',
    account_name: '峴港秘境日常',
    account_handle: '@danang_insider',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    proxy_id: 'proxy-res-vn-01',
    warmup_day: 8,
    status: 'warming',
    health_score: 82,
    daily_actions_count: 4,
    max_daily_actions: 6,
    target_niches: ['東南亞旅行', '網美打卡', '海島度假'],
    last_action_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
  },
  {
    id: 'acc-threads-01',
    platform: 'threads',
    account_name: '宜蘭生活探店手扎',
    account_handle: '@yilan_goodvibes',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    proxy_id: 'proxy-home-yilan',
    warmup_day: 6,
    status: 'warming',
    health_score: 75,
    daily_actions_count: 2,
    max_daily_actions: 4,
    target_niches: ['宜蘭民宿', '私房景點', '美食探店'],
    last_action_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
  },
  {
    id: 'acc-tiktok-01',
    platform: 'tiktok',
    account_name: '東南亞包車老司機',
    account_handle: '@vietnam_trip_pro',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    proxy_id: 'proxy-res-vn-01',
    warmup_day: 13,
    status: 'mature',
    health_score: 92,
    daily_actions_count: 2,
    max_daily_actions: 4,
    target_niches: ['包車旅遊', '機場接送', '越南自由行'],
    last_action_at: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 13).toISOString(),
  },
  {
    id: 'acc-dcard-01',
    platform: 'dcard',
    account_name: '旅行成癮背包客',
    account_handle: '@traveler_tw',
    avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
    proxy_id: 'proxy-res-tw-01',
    warmup_day: 4,
    status: 'warming',
    health_score: 68,
    daily_actions_count: 1,
    max_daily_actions: 3,
    target_niches: ['旅遊板', '國外旅遊', '省錢攻略'],
    last_action_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
  },
  {
    id: 'acc-x-01',
    platform: 'x',
    account_name: '台商經貿與海外行銷',
    account_handle: '@vn_tw_biz',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80',
    proxy_id: 'proxy-res-tw-01',
    warmup_day: 14,
    status: 'mature',
    health_score: 98,
    daily_actions_count: 3,
    max_daily_actions: 5,
    target_niches: ['商業考察', '跨境電商', '越南投資'],
    last_action_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
  }
]

let globalLogs: SocialLog[] = [
  {
    id: 'log-01',
    account_id: 'acc-fb-01',
    account_name: '旅遊行家-小陳 (主號)',
    platform: 'facebook',
    action_type: 'warmup_scroll',
    details: '模擬真人使用家用原生 IP 登入，隨機瀏覽 Facebook 動態時報 22 分鐘，停留檢視 6 則在地旅遊貼文',
    status: 'success',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'log-02',
    account_id: 'acc-ig-01',
    account_name: '峴港秘境日常',
    platform: 'instagram',
    action_type: 'warmup_like',
    details: '透過越南住宅代理連線，探索 Explore 頁面，隨機對 3 則 #DaNangTrip 貼文點讚，觀看 1 則 Reels 25 秒',
    status: 'success',
    created_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
  },
  {
    id: 'log-03',
    account_id: 'acc-threads-01',
    account_name: '宜蘭生活探店手扎',
    platform: 'threads',
    action_type: 'warmup_comment',
    details: 'Day 6 互動：加入宜蘭在地話題討論，AI 自動生成自然親切心得留言：「這家真的超低調推！上週末去吃也是滿滿人」',
    status: 'success',
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  }
]

export const StorageService = {
  // Proxies
  getProxies: () => {
    // Return copies with updated assigned_count
    return globalProxies.map(p => ({
      ...p,
      assigned_count: globalAccounts.filter(a => a.proxy_id === p.id).length
    }))
  },
  addProxy: (proxy: Omit<SocialProxy, 'id' | 'created_at' | 'updated_at'>) => {
    const newProxy: SocialProxy = {
      ...proxy,
      id: `proxy-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assigned_count: 0,
    }
    globalProxies = [newProxy, ...globalProxies]
    return newProxy
  },
  updateProxy: (id: string, updates: Partial<SocialProxy>) => {
    globalProxies = globalProxies.map(p => p.id === id ? {
      ...p,
      ...updates,
      port: updates.port !== undefined ? Number(updates.port) : p.port,
      updated_at: new Date().toISOString()
    } : p)
    return globalProxies.find(p => p.id === id)
  },
  deleteProxy: (id: string) => {
    globalProxies = globalProxies.filter(p => p.id !== id)
    // Clear proxy_id on attached accounts
    globalAccounts = globalAccounts.map(a => a.proxy_id === id ? { ...a, proxy_id: undefined } : a)
    return true
  },

  // Accounts
  getAccounts: () => {
    const proxies = StorageService.getProxies()
    return globalAccounts.map(acc => ({
      ...acc,
      proxy: proxies.find(p => p.id === acc.proxy_id) || null
    }))
  },
  addAccount: (account: Omit<SocialAccount, 'id' | 'created_at' | 'updated_at'>) => {
    const newAcc: SocialAccount = {
      ...account,
      id: `acc-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    globalAccounts = [newAcc, ...globalAccounts]
    return newAcc
  },
  updateAccount: (id: string, updates: Partial<SocialAccount>) => {
    globalAccounts = globalAccounts.map(a => a.id === id ? { ...a, ...updates, updated_at: new Date().toISOString() } : a)
    return globalAccounts.find(a => a.id === id)
  },
  deleteAccount: (id: string) => {
    globalAccounts = globalAccounts.filter(a => a.id !== id)
    return true
  },

  // Logs
  getLogs: () => [...globalLogs],
  addLog: (log: Omit<SocialLog, 'id' | 'created_at'>) => {
    const newLog: SocialLog = {
      ...log,
      id: `log-${Date.now()}`,
      created_at: new Date().toISOString(),
    }
    globalLogs = [newLog, ...globalLogs.slice(0, 99)] // keep last 100
    return newLog
  },

  // Warm-up runner for accounts
  runWarmupForAccount: (account: SocialAccount) => {
    const day = account.warmup_day
    let actionType: SocialLog['action_type'] = 'warmup_scroll'
    let detailMsg = ''
    let newHealth = Math.min(100, account.health_score + Math.floor(Math.random() * 4) + 2)
    let nextDay = day

    if (day <= 3) {
      // Phase 1: Silent immersion
      actionType = 'warmup_scroll'
      const minutes = Math.floor(Math.random() * 15) + 15
      const posts = Math.floor(Math.random() * 5) + 5
      detailMsg = `【階段一：靜默潛伏期 Day ${day}】模擬真人設備與獨立 IP，隨機滾動動態 ${minutes} 分鐘，瀏覽 ${posts} 則熱門貼文，零發文零私訊，累積安全設備指紋`
      nextDay = day + 1
    } else if (day <= 7) {
      // Phase 2: Light engagement
      actionType = 'warmup_like'
      const likes = Math.floor(Math.random() * 3) + 2
      const follows = Math.floor(Math.random() * 2) + 1
      detailMsg = `【階段二：輕度互動期 Day ${day}】模擬瀏覽同業話題，對 ${likes} 則相關推薦貼文點讚，關注 ${follows} 個官方優質專頁，觀看影片 40 秒，模擬真實受眾偏好`
      nextDay = day + 1
    } else if (day <= 11) {
      // Phase 3: Social integration
      actionType = 'warmup_comment'
      detailMsg = `【階段三：社交融入期 Day ${day}】AI 依社群討論熱點生成正面心得留言 1 則，自然加入目標群組話題討論，帳號權重顯著上升`
      nextDay = day + 1
    } else {
      // Phase 4: Mature
      actionType = 'warmup_scroll'
      detailMsg = `【階段四：成熟發布期 Day ${day}+】帳號健康度評級極佳 (${newHealth}%)，已完成完整 14 天擬人化養成！已解鎖方案 A (Copilot) 與方案 B (矩陣自動排程) 發布權限`
      nextDay = Math.min(30, day + 1)
    }

    const newStatus = nextDay >= 12 ? 'mature' : 'warming'

    StorageService.updateAccount(account.id, {
      warmup_day: nextDay,
      health_score: newHealth,
      status: newStatus,
      last_action_at: new Date().toISOString(),
      daily_actions_count: account.daily_actions_count + 1,
    })

    const log = StorageService.addLog({
      account_id: account.id,
      account_name: account.account_name,
      platform: account.platform,
      action_type: actionType,
      details: detailMsg,
      status: 'success',
    })

    return { log, newHealth, nextDay, newStatus }
  },

  // Official Rentable Proxies Management (AI-GATE 官方供租用 IP 資源庫)
  getOfficialProxies: () => {
    return [...globalOfficialProxies]
  },

  addOfficialProxy: (proxy: Omit<OfficialRentableProxy, 'id' | 'created_at' | 'updated_at' | 'current_tenants_count'>) => {
    const newOfficial: OfficialRentableProxy = {
      ...proxy,
      id: `off-${Date.now()}`,
      current_tenants_count: 0,
      status: 'available',
      is_active: proxy.is_active !== undefined ? proxy.is_active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    globalOfficialProxies = [newOfficial, ...globalOfficialProxies]
    return newOfficial
  },

  updateOfficialProxy: (id: string, updates: Partial<OfficialRentableProxy>) => {
    globalOfficialProxies = globalOfficialProxies.map(p => p.id === id ? {
      ...p,
      ...updates,
      port: updates.port !== undefined ? Number(updates.port) : p.port,
      monthly_price_twd: updates.monthly_price_twd !== undefined ? Number(updates.monthly_price_twd) : p.monthly_price_twd,
      max_tenants: updates.max_tenants !== undefined ? Number(updates.max_tenants) : p.max_tenants,
      updated_at: new Date().toISOString(),
    } : p)
    return globalOfficialProxies.find(p => p.id === id)
  },

  deleteOfficialProxy: (id: string) => {
    globalOfficialProxies = globalOfficialProxies.filter(p => p.id !== id)
    return true
  },

  // Leases Management (使用者租用官方 IP 紀錄)
  getLeases: (userId?: string) => {
    const list = userId ? globalLeases.filter(l => l.user_id === userId) : globalLeases
    return list.map(l => ({
      ...l,
      official_proxy: globalOfficialProxies.find(p => p.id === l.official_proxy_id)
    }))
  },

  leaseOfficialProxy: (userId: string, officialProxyId: string) => {
    const offProxy = globalOfficialProxies.find(p => p.id === officialProxyId)
    if (!offProxy) {
      throw new Error('找不到指定的官方 IP')
    }
    if (offProxy.status === 'rented_out' || offProxy.current_tenants_count >= offProxy.max_tenants) {
      throw new Error('該官方 IP 目前已被其他客戶專屬租用中，暫無空位')
    }
    if (offProxy.status === 'maintenance') {
      throw new Error('該官方 IP 目前維護保養中，暫停租用')
    }

    const leaseId = `lease-${Date.now()}`
    const rentedAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() // 30 days lease

    const newLease: ProxyLease = {
      id: leaseId,
      user_id: userId,
      official_proxy_id: offProxy.id,
      status: 'active',
      rented_at: rentedAt,
      expires_at: expiresAt,
      created_at: rentedAt,
      updated_at: rentedAt,
    }
    globalLeases.unshift(newLease)

    // Update official proxy tenant count & status
    const newTenantsCount = offProxy.current_tenants_count + 1
    StorageService.updateOfficialProxy(offProxy.id, {
      current_tenants_count: newTenantsCount,
      status: newTenantsCount >= offProxy.max_tenants ? 'rented_out' : 'available'
    })

    // Automatically inject this rented proxy into the user's active proxy pool (globalProxies)
    const leasedSocialProxy: SocialProxy = {
      id: `leased-${leaseId}`,
      user_id: userId,
      name: `🏢 [官方租用] ${offProxy.name}`,
      proxy_type: offProxy.proxy_type,
      protocol: offProxy.protocol,
      host: offProxy.host,
      port: offProxy.port,
      username: offProxy.username,
      password: offProxy.password,
      country: offProxy.country,
      city: offProxy.city,
      isp: offProxy.isp,
      status: 'active',
      latency_ms: offProxy.latency_ms,
      notes: `AI-GATE 官方乾淨原生 IP，專屬租用中 (至 ${new Date(expiresAt).toLocaleDateString()})`,
      source: 'official_leased',
      lease_id: leaseId,
      official_proxy_id: offProxy.id,
      monthly_price_twd: offProxy.monthly_price_twd,
      expires_at: expiresAt,
      assigned_count: 0,
      created_at: rentedAt,
      updated_at: rentedAt,
    }

    globalProxies = [leasedSocialProxy, ...globalProxies]

    return {
      lease: newLease,
      proxy: leasedSocialProxy,
    }
  },

  releaseOfficialProxy: (userId: string, leaseId: string) => {
    const leaseIndex = globalLeases.findIndex(l => l.id === leaseId && (!userId || l.user_id === userId))
    if (leaseIndex === -1) {
      // Also try matching directly by id if userId not matching strictly in mock
      const directIndex = globalLeases.findIndex(l => l.id === leaseId)
      if (directIndex === -1) {
        // Fallback: look for proxy in globalProxies
        const pIndex = globalProxies.findIndex(p => p.lease_id === leaseId || p.id === leaseId)
        if (pIndex !== -1) {
          const p = globalProxies[pIndex]
          globalProxies.splice(pIndex, 1)
          if (p.official_proxy_id) {
            const off = globalOfficialProxies.find(o => o.id === p.official_proxy_id)
            if (off) {
              const newCount = Math.max(0, off.current_tenants_count - 1)
              StorageService.updateOfficialProxy(off.id, {
                current_tenants_count: newCount,
                status: 'available',
              })
            }
          }
          return true
        }
        return false
      }
    }

    const lease = globalLeases[leaseIndex !== -1 ? leaseIndex : 0]
    lease.status = 'canceled'
    lease.updated_at = new Date().toISOString()

    // Decrement official proxy count
    const off = globalOfficialProxies.find(o => o.id === lease.official_proxy_id)
    if (off) {
      const newCount = Math.max(0, off.current_tenants_count - 1)
      StorageService.updateOfficialProxy(off.id, {
        current_tenants_count: newCount,
        status: 'available',
      })
    }

    // Remove from globalProxies
    globalProxies = globalProxies.filter(p => p.lease_id !== leaseId && p.id !== `leased-${leaseId}`)

    // Unbind any account bound to this leased proxy
    globalAccounts = globalAccounts.map(a =>
      a.proxy_id === `leased-${leaseId}` ? { ...a, proxy_id: undefined } : a
    )

    return true
  }
}

