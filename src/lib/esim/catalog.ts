import { MicroEsimPlan } from './microesim'

export interface DestinationMeta {
  code: string
  name: string
  nameEn: string
  flag: string
  region: 'Asia' | 'Europe' | 'Americas' | 'Oceania' | 'Global' | 'Other'
  popular: boolean
  description: string
  popularRank?: number
}

export interface EsimPricingSettings {
  hkd_twd_rate: number // 港幣換台幣匯率 e.g. 4.15
  default_markup: number // 利潤倍率 e.g. 1.35 (35% 毛利)
  fixed_fee_twd: number // 每單固定手續費 e.g. 20
  round_to_9: boolean // 9 字尾美化 e.g. true
  min_price_twd: number // 最低售價門檻 e.g. 79
  promo_discount: number // 全館折扣成數 (0.9 代表9折, 1.0 代表不打折)
  promo_title: string // 促銷活動名稱 e.g. "出國限時早鳥 9 折特惠"
  promo_active: boolean // 是否啟動促銷活動
  country_markups?: Record<string, number> // 個別國家自訂利潤倍率 e.g. { "JP": 1.30, "EU": 1.40 }
}

export const DEFAULT_PRICING_SETTINGS: EsimPricingSettings = {
  hkd_twd_rate: 4.15,
  default_markup: 1.35,
  fixed_fee_twd: 20,
  round_to_9: true,
  min_price_twd: 79,
  promo_discount: 1.0,
  promo_title: '',
  promo_active: false,
  country_markups: {},
}

export interface EsimAppRestrictions {
  tiktok: { allowed: boolean; reason?: string }
  chatgpt: { allowed: boolean; reason?: string }
  googleLine: { allowed: boolean; note?: string }
  hotspot: { allowed: boolean; note?: string }
  voiceCalls: { allowed: boolean; note?: string }
  ipEgress: string // e.g. "日本 (原生 IP)", "香港 (漫遊 IP)"
  isLocalIp: boolean
  specialNotes: string[]
}

export interface ThrottleRuleInfo {
  type: 'speed_throttle' | 'terminate' | 'unlimited_high_speed'
  raw: string
  speed: string // e.g. "128 kbps", "256 kbps", "384 kbps", "512 kbps", "1 Mbps", "5 Mbps", "10 Mbps", "全程不降速", "停止上網"
  shortLabel: string // e.g. "用畢降速 128 kbps 吃到飽", "全程高速不降速", "流量用畢停止上網"
  fullLabel: string // e.g. "高速流量用畢降速至 128 kbps 輕速吃到飽不斷線"
  badge: string // e.g. "降速 128 kbps", "降速 5 Mbps", "用畢斷線", "全程高速"
  description: string // 詳細可做什麼說明，例如 "高速用畢降速至 128 kbps，可傳文字訊息、LINE 聊天與 Google 地圖導航，不斷線"
  canStreamVideo: boolean
  canVoiceCall: boolean
  canBasicMessaging: boolean
}

export interface ParsedEsimPlan extends MicroEsimPlan {
  planType: 'daily' | 'total' | 'unlimited'
  dataTierLabel: string // e.g. "每日 1GB", "總量 10GB", "無限上網"
  retailPriceTwd: number
  originalPriceTwd?: number // 若啟動促銷活動，此處為原價
  costHkd: number
  primaryCountryCode: string
  primaryCountryName: string
  flagEmoji: string
  restrictions: EsimAppRestrictions
  throttleRule: ThrottleRuleInfo
}

export const DESTINATIONS: Record<string, DestinationMeta> = {
  JP: { code: 'JP', name: '日本', nameEn: 'Japan', flag: '🇯🇵', region: 'Asia', popular: true, popularRank: 1, description: '全境 Docomo / SoftBank 4G/5G 雙網原生高速吃到飽' },
  KR: { code: 'KR', name: '韓國', nameEn: 'South Korea', flag: '🇰🇷', region: 'Asia', popular: true, popularRank: 2, description: 'SK Telecom / KT 頂級高速網路，即開即用免繁瑣認證' },
  TH: { code: 'TH', name: '泰國', nameEn: 'Thailand', flag: '🇹🇭', region: 'Asia', popular: true, popularRank: 3, description: 'TrueMove / AIS 5G 高速覆蓋曼谷、清邁、普吉島全境' },
  TW: { code: 'TW', name: '台灣', nameEn: 'Taiwan', flag: '🇹🇼', region: 'Asia', popular: true, popularRank: 4, description: '中華電信 / 台灣大哥大 4G/5G 原生線路，環島訊號無死角' },
  HK: { code: 'HK', name: '香港', nameEn: 'Hong Kong', flag: '🇭🇰', region: 'Asia', popular: true, popularRank: 5, description: 'CMHK 4G/5G 高速上網，免翻牆直連全社群網站' },
  MO: { code: 'MO', name: '澳門', nameEn: 'Macau', flag: '🇲🇴', region: 'Asia', popular: true, popularRank: 6, description: 'CTM 澳門電訊 5G 原生極速，賭場與市區連線穩定' },
  CN: { code: 'CN', name: '中國大陸', nameEn: 'China', flag: '🇨🇳', region: 'Asia', popular: true, popularRank: 7, description: 'CMCC 中國移動免翻牆漫遊線路，LINE/FB/IG 正常暢連' },
  VN: { code: 'VN', name: '越南', nameEn: 'Vietnam', flag: '🇻🇳', region: 'Asia', popular: true, popularRank: 8, description: 'Vinaphone / Viettel 河內、峴港、胡志明市極速 5G/4G' },
  SG: { code: 'SG', name: '新加坡', nameEn: 'Singapore', flag: '🇸🇬', region: 'Asia', popular: true, popularRank: 9, description: 'Singtel 新加坡第一大電信 5G 極速網路' },
  MY: { code: 'MY', name: '馬來西亞', nameEn: 'Malaysia', flag: '🇲🇾', region: 'Asia', popular: true, popularRank: 10, description: 'Maxis / Celcom 吉隆坡、沙巴、檳城全境暢行' },
  PH: { code: 'PH', name: '菲律賓', nameEn: 'Philippines', flag: '🇵🇭', region: 'Asia', popular: true, popularRank: 11, description: 'Globe / Smart 宿霧、長灘島、馬尼拉度假必備' },
  ID: { code: 'ID', name: '印尼 (峇里島)', nameEn: 'Indonesia', flag: '🇮🇩', region: 'Asia', popular: true, popularRank: 12, description: 'Telkomsel 原生 4G/5G 峇里島觀光首選' },
  US: { code: 'US', name: '美國', nameEn: 'United States', flag: '🇺🇸', region: 'Americas', popular: true, popularRank: 13, description: 'AT&T / T-Mobile 全美雙網 5G，支援熱點分享' },
  CA: { code: 'CA', name: '加拿大', nameEn: 'Canada', flag: '🇨🇦', region: 'Americas', popular: true, popularRank: 14, description: 'Bell / Telus 溫哥華、多倫多全境穩定連線' },
  AU: { code: 'AU', name: '澳洲', nameEn: 'Australia', flag: '🇦🇺', region: 'Oceania', popular: true, popularRank: 15, description: 'Optus / Telstra 雪梨、墨爾本、布里斯本 5G 高速' },
  NZ: { code: 'NZ', name: '紐西蘭', nameEn: 'New Zealand', flag: '🇳🇿', region: 'Oceania', popular: true, popularRank: 16, description: 'Spark / One NZ 南北島自駕旅遊首選' },
  EU: { code: 'EU', name: '歐洲 33 國通用', nameEn: 'Europe 33 Countries', flag: '🇪🇺', region: 'Europe', popular: true, popularRank: 17, description: '英法德義西瑞奧荷等 33 國跨國免換卡自動切換' },
  GB: { code: 'GB', name: '英國', nameEn: 'United Kingdom', flag: '🇬🇧', region: 'Europe', popular: true, popularRank: 18, description: 'EE / Vodafone / O2 倫敦與全英高速暢遊' },
  FR: { code: 'FR', name: '法國', nameEn: 'France', flag: '🇫🇷', region: 'Europe', popular: true, popularRank: 19, description: 'Orange / SFR 巴黎與南法度假連線優選' },
  DE: { code: 'DE', name: '德國', nameEn: 'Germany', flag: '🇩🇪', region: 'Europe', popular: true, popularRank: 20, description: 'Telekom / Vodafone 德國頂級商務與旅遊連線' },
  IT: { code: 'IT', name: '義大利', nameEn: 'Italy', flag: '🇮🇹', region: 'Europe', popular: true, popularRank: 21, description: 'TIM / Vodafone 羅馬、米蘭、威尼斯穩定訊號' },
  ES: { code: 'ES', name: '西班牙', nameEn: 'Spain', flag: '🇪🇸', region: 'Europe', popular: true, popularRank: 22, description: 'Movistar / Orange 馬德里、巴塞隆納暢快上網' },
  CH: { code: 'CH', name: '瑞士', nameEn: 'Switzerland', flag: '🇨🇭', region: 'Europe', popular: true, popularRank: 23, description: 'Swisscom / Sunrise 阿爾卑斯山區優質覆蓋' },
  TR: { code: 'TR', name: '土耳其', nameEn: 'Turkey', flag: '🇹🇷', region: 'Europe', popular: true, popularRank: 24, description: 'Turkcell / Vodafone 伊斯坦堡與卡帕多奇亞熱門' },
  GLOBAL: { code: 'GLOBAL', name: '全球 130+ 國通用', nameEn: 'Global 130+ Countries', flag: '🌐', region: 'Global', popular: true, popularRank: 25, description: '環球多國飛行、跨洲轉機必備全球漫遊方案' },
}

/**
 * 取得國家資訊（若非預設熱門國家則自動由代碼補全）
 */
export function getDestinationMeta(code: string): DestinationMeta {
  const upper = (code || '').toUpperCase().trim()
  if (DESTINATIONS[upper]) return DESTINATIONS[upper]

  // 跨國組合處理
  if (upper.includes(',')) {
    if (upper.includes('CN') && upper.includes('HK') && upper.includes('MO')) {
      return { code: upper, name: '中港澳多地', nameEn: 'China, HK & Macau', flag: '🇨🇳', region: 'Asia', popular: true, description: '中港澳免翻牆高速上網' }
    }
    if (upper.includes('SG') && upper.includes('MY')) {
      return { code: upper, name: '星馬雙國', nameEn: 'Singapore & Malaysia', flag: '🇸🇬', region: 'Asia', popular: true, description: '新加坡與馬來西亞雙國通用' }
    }
    if (upper.includes('AU') && upper.includes('NZ')) {
      return { code: upper, name: '紐澳雙國', nameEn: 'Australia & New Zealand', flag: '🇦🇺', region: 'Oceania', popular: true, description: '澳洲與紐西蘭雙國通用' }
    }
    if (upper.split(',').length > 10) {
      return { code: upper, name: '全球多國通用', nameEn: 'Global Countries', flag: '🌐', region: 'Global', popular: true, description: '全球超過 100+ 國家漫遊' }
    }
  }

  // 英文國家代碼轉名稱
  try {
    const regionNames = new Intl.DisplayNames(['zh-TW'], { type: 'region' })
    const name = regionNames.of(upper) || upper
    return {
      code: upper,
      name,
      nameEn: upper,
      flag: getFlagEmoji(upper),
      region: 'Other',
      popular: false,
      description: `${name} 出國旅遊高速上網方案`,
    }
  } catch {
    return {
      code: upper,
      name: upper,
      nameEn: upper,
      flag: '🌐',
      region: 'Other',
      popular: false,
      description: `${upper} 出國旅遊高速上網方案`,
    }
  }
}

/**
 * ISO 兩碼轉國旗 Emoji
 */
export function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐'
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

/**
 * 分析方案在常見 App (TikTok, ChatGPT, Google, LINE) 與網路架構上的使用限制
 */
export function analyzePlanRestrictions(plan: MicroEsimPlan): EsimAppRestrictions {
  const rawIp = (plan.ip || '').toUpperCase().trim()
  const rawDesc = (plan.special_desc || '').toLowerCase()
  const rawRule = (plan.rule_desc || '').toLowerCase()
  const countryCode = (plan.code || '').toUpperCase().trim()

  // 1. IP 歸屬地判斷
  let ipEgress = rawIp || '當地原生/漫遊'
  let isLocalIp = false
  if (rawIp.includes('HK')) {
    ipEgress = '香港 (漫遊 IP)'
  } else if (rawIp.includes('JP')) {
    ipEgress = '日本 (原生 IP)'
    isLocalIp = countryCode.includes('JP')
  } else if (rawIp.includes('SG')) {
    ipEgress = '新加坡 (漫遊 IP)'
  } else if (rawIp.includes('KR')) {
    ipEgress = '韓國 (原生 IP)'
    isLocalIp = countryCode.includes('KR')
  } else if (rawIp.includes('US')) {
    ipEgress = '美國 (原生 IP)'
    isLocalIp = countryCode.includes('US')
  } else if (rawIp.includes('GB') || rawIp.includes('DE') || rawIp.includes('PL') || rawIp.includes('FR')) {
    ipEgress = '歐洲 (漫遊 IP)'
  }

  // 2. TikTok 限制
  let tiktokAllowed = true
  let tiktokReason = '原生/優質線路，可正常使用國際版 TikTok'
  if (rawIp.includes('HK')) {
    tiktokAllowed = false
    tiktokReason = '因香港法規限制，TikTok 官方不開放香港 IP 存取服務'
  } else if (rawDesc.includes('not support tiktok') || rawDesc.includes('tiktok do not guarantee') || rawDesc.includes('not tiktok')) {
    tiktokAllowed = false
    tiktokReason = '此電信漫遊線路 TikTok 不保證正常存取'
  }

  // 3. ChatGPT (OpenAI) 限制
  let chatgptAllowed = true
  let chatgptReason = '支援 ChatGPT / OpenAI / Claude 等 AI 工具'
  if (rawIp.includes('HK') || rawIp.includes('CN')) {
    chatgptAllowed = false
    chatgptReason = 'OpenAI 官方未支援香港/中國 IP 區域'
  } else if (rawDesc.includes('not support chatgpt') || rawDesc.includes('gpt do not guarantee')) {
    chatgptAllowed = false
    chatgptReason = '此線路 OpenAI/ChatGPT 不保證正常存取'
  }

  // 4. Google / LINE / FB / IG
  const googleLineAllowed = true
  let googleLineNote = '免翻牆直連 Google, LINE, Facebook, IG, 各大社群網站'
  if (countryCode.includes('CN')) {
    googleLineNote = '中港澳免翻牆漫遊線路，免 VPN 直連 LINE / Google / FB / IG'
  }

  // 5. 熱點分享 (Hotspot)
  let hotspotAllowed = true
  let hotspotNote = '支援手機個人熱點分享功能'
  if (rawRule.includes('no hotspot') || rawDesc.includes('no hotspot') || rawDesc.includes('hotspot is not supported')) {
    hotspotAllowed = false
    hotspotNote = '此專用方案電信商限制個人熱點分享功能'
  }

  // 6. 語音通話與簡訊
  const voiceCalls = {
    allowed: false,
    note: '純出國數據上網卡，無門號。支援 LINE / WhatsApp / WeChat 網路語音通話'
  }

  // 7. 特殊說明清單解析 (special_desc)
  const specialNotes: string[] = []
  if (plan.special_desc) {
    const parts = plan.special_desc.split('|').map(s => s.trim()).filter(Boolean)
    for (const part of parts) {
      if (part.toLowerCase().includes('apn to')) {
        specialNotes.push(`需手動檢查 APN 設定為「${plan.apn?.trim()}」`)
      } else if (part.toLowerCase().includes('reinstall')) {
        specialNotes.push('若安裝失敗可刪除重新掃描安裝一次')
      } else if (part.toLowerCase().includes('activate upon arrival')) {
        specialNotes.push('抵達目的地國家連接當地基地台即自動開通啟用')
      } else if (part.toLowerCase().includes('data reset')) {
        specialNotes.push(`每日流量重置時間為 ${plan.date_reset || '當地跨日 00:00'}`)
      } else {
        specialNotes.push(part)
      }
    }
  }

  return {
    tiktok: { allowed: tiktokAllowed, reason: tiktokReason },
    chatgpt: { allowed: chatgptAllowed, reason: chatgptReason },
    googleLine: { allowed: googleLineAllowed, note: googleLineNote },
    hotspot: { allowed: hotspotAllowed, note: hotspotNote },
    voiceCalls,
    ipEgress,
    isLocalIp,
    specialNotes,
  }
}

/**
 * 解析方案降速規則與速率 (例如 128kbps, 256kbps, 384kbps, 512kbps, 1mbps, 5mbps, 10mbps, terminate, unlimited)
 */
export function parseThrottleRule(ruleDesc?: string): ThrottleRuleInfo {
  const raw = (ruleDesc || '').trim()
  const lower = raw.toLowerCase()

  // 1. Terminate / 斷線停止上網
  if (
    lower.includes('terminate') ||
    lower.includes('stop') ||
    lower.includes('斷線') ||
    lower.includes('用完即止')
  ) {
    return {
      type: 'terminate',
      raw,
      speed: '停止上網',
      shortLabel: '流量用畢停止上網',
      fullLabel: '流量用畢即停止上網 (直接結束連線，不額外扣款)',
      badge: '用畢斷線',
      description: '方案內含之高速流量使用完畢後即停止上網服務（斷線），不會產生任何超額費用。',
      canStreamVideo: false,
      canVoiceCall: false,
      canBasicMessaging: false,
    }
  }

  // 2. Unlimited High Speed / 全程高速不降速吃到飽
  if (
    lower === 'unlimited' ||
    lower === 'unlimited high speed' ||
    lower === 'unlimited highspeed' ||
    lower.includes('全程不降速') ||
    lower.includes('高速不限速')
  ) {
    return {
      type: 'unlimited_high_speed',
      raw,
      speed: '全程不降速',
      shortLabel: '全程高速吃到飽不降速',
      fullLabel: '全程維持 4G/5G 原生高速連線，不限速、不降速',
      badge: '全程高速不降速',
      description: '全程享受 4G/5G 當地電信原生極速飆網，不降速、不斷線，盡情追劇、視訊與工作。',
      canStreamVideo: true,
      canVoiceCall: true,
      canBasicMessaging: true,
    }
  }

  // 3. 有指定速率的降速型方案 (例如 "unlimited 128kbps", "unlimited 5mbps", "unlimited 384kbps", "unlimited 10mbps")
  const match = lower.match(/(\d+(?:\.\d+)?)\s*(kbps|mbps|k|m)/)
  if (match) {
    const num = parseFloat(match[1])
    const unitRaw = match[2].toLowerCase()
    const isMbps = unitRaw.startsWith('m')
    const unit = isMbps ? 'Mbps' : 'kbps'
    const speed = `${num} ${unit}`
    const speedKbps = isMbps ? num * 1024 : num

    let usageTips = ''
    let canStreamVideo = false
    let canVoiceCall = false
    let canBasicMessaging = true

    if (speedKbps <= 128) {
      usageTips = '支援傳送 LINE / WhatsApp 文字訊息與 Google Maps 定位導航（網頁載入較慢，不建議觀看影片）。'
      canVoiceCall = false
      canStreamVideo = false
    } else if (speedKbps <= 384) {
      usageTips = '支援 LINE 文字傳送與語音通話、Google Maps 導航與基本網頁瀏覽。'
      canVoiceCall = true
      canStreamVideo = false
    } else if (speedKbps <= 1024) {
      usageTips = '支援 LINE 語音通話、社群動態文字與圖片瀏覽、一般網頁載入與地圖導航。'
      canVoiceCall = true
      canStreamVideo = false
    } else {
      usageTips = '可順暢觀看 YouTube 720p/1080p 高畫質影音、社群短影音、視訊通話與快速載入所有網頁。'
      canVoiceCall = true
      canStreamVideo = true
    }

    return {
      type: 'speed_throttle',
      raw,
      speed,
      shortLabel: `用畢降速 ${speed} 吃到飽`,
      fullLabel: `高速用畢降速至 ${speed} 輕速吃到飽不斷線`,
      badge: `降速 ${speed}`,
      description: `高速流量用罄後降速至 ${speed} 無限流量吃到飽。${usageTips}`,
      canStreamVideo,
      canVoiceCall,
      canBasicMessaging,
    }
  }

  // 4. 預設吃到飽 (若無特別標註速率)
  if (lower.includes('unlimited')) {
    return {
      type: 'speed_throttle',
      raw,
      speed: '128 kbps',
      shortLabel: '用畢降速 128 kbps 吃到飽',
      fullLabel: '高速用畢降速至 128 kbps 輕速吃到飽不斷線',
      badge: '降速 128 kbps',
      description: '高速流量用罄後降速至 128 kbps 輕速吃到飽不斷線，支援 LINE 文字訊息與定位導航。',
      canStreamVideo: false,
      canVoiceCall: false,
      canBasicMessaging: true,
    }
  }

  // 5. 其它預設為斷線
  return {
    type: 'terminate',
    raw,
    speed: '停止上網',
    shortLabel: '流量用畢停止上網',
    fullLabel: '流量用畢即停止上網',
    badge: '用畢斷線',
    description: '方案高速流量使用完畢後即停止上網。',
    canStreamVideo: false,
    canVoiceCall: false,
    canBasicMessaging: false,
  }
}

/**
 * 將 MicroEsim 原生方案物件解析成商城展示格式，包含定價計算與限制分析
 */
export function parseMicroEsimPlan(
  plan: MicroEsimPlan,
  settingsInput?: Partial<EsimPricingSettings>
): ParsedEsimPlan {
  const settings: EsimPricingSettings = {
    ...DEFAULT_PRICING_SETTINGS,
    ...(settingsInput || {}),
  }

  const costHkd = parseFloat(plan.price) || 0
  const codes = (plan.code || '').split(',').map(c => c.trim().toUpperCase())
  const primaryCode = codes.length > 5 ? 'GLOBAL' : codes[0]
  const destMeta = getDestinationMeta(primaryCode)

  // 1. 決定適用的利潤倍率 (優先使用該國家個別倍率，否則使用全域 default_markup)
  let markup = settings.default_markup
  if (settings.country_markups && settings.country_markups[primaryCode]) {
    markup = settings.country_markups[primaryCode]
  }

  // 2. 計算原價台幣：成本(HKD) * 匯率 * 利潤倍率 + 基礎服務費
  let rawTwd = costHkd * settings.hkd_twd_rate * markup + settings.fixed_fee_twd
  let baseTwdPrice = Math.max(settings.min_price_twd, Math.round(rawTwd))

  // 3. 9 字尾美化
  if (settings.round_to_9 && baseTwdPrice > 100) {
    const rem = baseTwdPrice % 10
    if (rem !== 9) {
      baseTwdPrice = baseTwdPrice - rem + 9
    }
  }

  // 4. 計算全館促銷折扣 (若有開啟 promo_active 且折扣 < 1.0)
  let retailPriceTwd = baseTwdPrice
  let originalPriceTwd: number | undefined = undefined

  if (settings.promo_active && settings.promo_discount > 0 && settings.promo_discount < 1.0) {
    originalPriceTwd = baseTwdPrice
    const discounted = Math.round(baseTwdPrice * settings.promo_discount)
    retailPriceTwd = Math.max(settings.min_price_twd, discounted)
    if (settings.round_to_9 && retailPriceTwd > 100) {
      const rem = retailPriceTwd % 10
      if (rem !== 9) {
        retailPriceTwd = retailPriceTwd - rem + 9
      }
    }
  }

  // 5. 分析方案類型
  let planType: 'daily' | 'total' | 'unlimited' = 'daily'
  let dataTierLabel = plan.data || ''

  const upperData = (plan.data || '').toUpperCase()
  const upperName = (plan.channel_dataplan_name || '').toUpperCase()

  if (upperData.includes('UNLIMITED') || upperName.includes('UNLIMITED')) {
    planType = 'unlimited'
    dataTierLabel = '高速吃到飽'
  } else if (upperData.startsWith('DAILY') || upperName.includes('DAILY')) {
    planType = 'daily'
    const match = upperData.match(/DAILY(\d+)(MB|GB)/i) || upperName.match(/DAILY(\d+)(MB|GB)/i)
    if (match) {
      dataTierLabel = `每日 ${match[1]}${match[2].toUpperCase()}`
    } else {
      dataTierLabel = plan.data
    }
  } else if (upperData.startsWith('TOTAL') || upperName.includes('TOTAL')) {
    planType = 'total'
    const match = upperData.match(/TOTAL(\d+)(MB|GB)/i) || upperName.match(/TOTAL(\d+)(MB|GB)/i)
    if (match) {
      dataTierLabel = `總量 ${match[1]}${match[2].toUpperCase()}`
    } else {
      dataTierLabel = plan.data
    }
  }

  // 6. 分析 App 與網路架構使用限制
  const restrictions = analyzePlanRestrictions(plan)

  // 7. 解析降速規格與速率
  const throttleRule = parseThrottleRule(plan.rule_desc)

  return {
    ...plan,
    planType,
    dataTierLabel,
    retailPriceTwd,
    originalPriceTwd,
    costHkd,
    primaryCountryCode: primaryCode,
    primaryCountryName: destMeta.name,
    flagEmoji: destMeta.flag,
    restrictions,
    throttleRule,
  }
}
