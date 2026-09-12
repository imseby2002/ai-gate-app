import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export interface MicroEsimPlan {
  channel_dataplan_id: string
  channel_dataplan_name: string
  price: string          // e.g. "11.22"
  currency: string       // "HKD"
  status: string         // "1" (active)
  day: number            // validity days e.g. 1, 3, 5, 7, 10, 15, 30
  data: string           // e.g. "Daily1GB", "Total10GB", "Unlimited"
  apn: string            // APN e.g. "vmobile.jp", "cmhk"
  code: string           // ISO country codes e.g. "JP", "KR", "CN,HK,MO,TW"
  networks: string       // Operator & radio access e.g. "JP:DOCOMO[LTE;4G]|"
  active_type: string    // "ACTIVEDBYDEVICE" or "ACTIVEDBYORDER"
  ip: string             // Local or egress IP e.g. "JP", "HK"
  rule_desc: string      // e.g. "unlimited 256kbps", "terminate"
  validity_period?: string
  date_reset?: string
  usage_reset?: string
  special_desc?: string
}

export interface MicroEsimAccountBalance {
  balance: number
  currency: string
  account: string
}

export interface MicroEsimSubscribeResult {
  code: number
  msg: string
  result?: {
    topup_id?: string
    order_id?: string
    channel_dataplan_id?: string
    quantity?: number
    [key: string]: any
  }
  error_code?: string
}

export interface MicroEsimTopupDetail {
  code: number
  msg: string
  result?: {
    topup_id?: string
    iccid?: string
    device_ids?: string[]
    qr_code?: string
    qrcode?: string[]
    ac?: string            // LPA:1$xxx$xxx activation code
    lpa_str?: string[]
    ios_esim_install_link?: string[]
    android_esim_install_link?: string[]
    status?: string        // activation status e.g. "completed"
    dataplan_name?: string
    channel_dataplan_name?: string
    data_remaining?: string
    apn?: string
    [key: string]: any
  }
  error_code?: string
}

export class MicroEsimClient {
  private account: string
  private secret: string
  private saltHex: string
  private baseUrl: string
  private cacheFilePath: string
  private static memoryCache: { plans: MicroEsimPlan[]; timestamp: number } | null = null
  private static CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

  constructor() {
    this.account = process.env.MICROESIM_ACCOUNT || 'imseby'
    this.secret = process.env.MICROESIM_SECRET || 'b918bb3fga9ec6ag000a838fe9cb'
    this.saltHex = process.env.MICROESIM_SALT_HEX || '1a236dbfdd9d1e5189b1a6fb0067145c'
    this.baseUrl = process.env.MICROESIM_BASE_URL || 'https://microesim.top/allesim/v1'
    this.cacheFilePath = path.join(process.cwd(), 'scratch', 'microesim_plans_cache.json')
  }

  /**
   * 產生存取 MICROESIM.TOP 所需的安全簽名 Header
   */
  private getHeaders(): Record<string, string> {
    const nonce = crypto.randomBytes(8).toString('hex')
    const timestamp = Date.now().toString()
    const salt = Buffer.from(this.saltHex, 'hex')
    
    // PBKDF2 SHA-256, 1024 rounds, 32 bytes
    const keyBin = crypto.pbkdf2Sync(this.secret, salt, 1024, 32, 'sha256')
    const keyHex = keyBin.toString('hex')
    
    // HMAC-SHA256
    const signature = crypto
      .createHmac('sha256', keyHex)
      .update(this.account + nonce + timestamp)
      .digest('hex')

    return {
      'Accept': 'application/json',
      'MICROESIM-ACCOUNT': this.account,
      'MICROESIM-NONCE': nonce,
      'MICROESIM-TIMESTAMP': timestamp,
      'MICROESIM-SIGN': signature,
    }
  }

  /**
   * 查詢 MICROESIM 帳戶餘額
   */
  async getAccountBalance(): Promise<MicroEsimAccountBalance> {
    const res = await fetch(`${this.baseUrl}/accountBalance`, {
      method: 'POST',
      headers: this.getHeaders(),
    })
    const data = await res.json()
    if (data.code !== 1) {
      throw new Error(`MicroEsim balance check failed: ${data.msg || JSON.stringify(data)}`)
    }
    return data.result
  }

  /**
   * 取得全球所有 eSIM 方案清單（支援多級快取：記憶體 → 磁碟 → API）
   */
  async getDataplanList(forceRefresh: boolean = false): Promise<MicroEsimPlan[]> {
    const now = Date.now()

    // 1. 記憶體快取
    if (!forceRefresh && MicroEsimClient.memoryCache && (now - MicroEsimClient.memoryCache.timestamp < MicroEsimClient.CACHE_TTL_MS)) {
      return MicroEsimClient.memoryCache.plans
    }

    // 2. 本地磁碟快取
    if (!forceRefresh && fs.existsSync(this.cacheFilePath)) {
      try {
        const fileContent = fs.readFileSync(this.cacheFilePath, 'utf8')
        const parsed = JSON.parse(fileContent)
        if (parsed.timestamp && (now - parsed.timestamp < MicroEsimClient.CACHE_TTL_MS) && Array.isArray(parsed.plans)) {
          MicroEsimClient.memoryCache = { plans: parsed.plans, timestamp: parsed.timestamp }
          return parsed.plans
        }
      } catch (err) {
        console.warn('[MicroEsim] Failed to read disk cache:', err)
      }
    }

    // 3. API 呼叫
    console.log('[MicroEsim] Fetching latest dataplan catalog from microesim.top...')
    const res = await fetch(`${this.baseUrl}/esimDataplanList`, {
      method: 'GET',
      headers: this.getHeaders(),
    })

    if (!res.ok) {
      throw new Error(`MicroEsim API error: HTTP ${res.status}`)
    }

    const data = await res.json()
    if (data.code !== 1 || !Array.isArray(data.result)) {
      throw new Error(`MicroEsim plans fetch failed: ${data.msg || 'Unknown error'}`)
    }

    const plans: MicroEsimPlan[] = data.result

    // 寫入記憶體快取
    MicroEsimClient.memoryCache = { plans, timestamp: now }

    // 異步寫入本地檔案快取，不阻塞
    try {
      const dir = path.dirname(this.cacheFilePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.cacheFilePath, JSON.stringify({ timestamp: now, count: plans.length, plans }), 'utf8')
    } catch (err) {
      console.warn('[MicroEsim] Failed to save disk cache:', err)
    }

    return plans
  }

  /**
   * 訂購 / 下單購買 eSIM
   * @param channelDataplanId 方案 ID
   * @param quantity 訂購張數 (1-100)
   */
  async subscribeEsim(channelDataplanId: string, quantity: number = 1): Promise<MicroEsimSubscribeResult> {
    const body = new URLSearchParams({
      number: String(quantity),
      channel_dataplan_id: channelDataplanId,
    })

    const headers = {
      ...this.getHeaders(),
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    console.log(`[MicroEsim] Subscribing plan ${channelDataplanId}, qty: ${quantity}...`)
    const res = await fetch(`${this.baseUrl}/esimSubscribe`, {
      method: 'POST',
      headers,
      body: body.toString(),
    })

    const data = await res.json()
    return data
  }

  /**
   * 取得 eSIM 開通與 QR Code 細節
   * @param topupId 訂購後取得的 topup_id
   */
  async getTopupDetail(topupId: string): Promise<MicroEsimTopupDetail> {
    const body = new URLSearchParams({
      topup_id: topupId,
    })

    const headers = {
      ...this.getHeaders(),
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    const res = await fetch(`${this.baseUrl}/topupDetail`, {
      method: 'POST',
      headers,
      body: body.toString(),
    })

    const data = await res.json()
    return data
  }

  /**
   * 取得營運通知公告（例如電信商網路維護、頻段調整）
   */
  async getDailyNotices(date?: string): Promise<any[]> {
    const targetDate = date || new Date().toISOString().split('T')[0]
    const res = await fetch(`${this.baseUrl}/dailyNotice?date=${targetDate}`, {
      method: 'GET',
      headers: this.getHeaders(),
    })
    const data = await res.json()
    return data.result || []
  }
}

export const microEsimClient = new MicroEsimClient()
