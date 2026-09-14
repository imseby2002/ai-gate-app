export type ProxyType = 'home_static' | 'residential' | 'mobile_4g'
export type ProxyProtocol = 'http' | 'https' | 'socks5'
export type ProxyStatus = 'active' | 'testing' | 'error' | 'offline'

export interface SocialProxy {
  id: string
  user_id?: string
  name: string
  proxy_type: ProxyType
  protocol: ProxyProtocol
  host: string
  port: number
  username?: string
  password?: string
  country: string
  city?: string
  isp?: string
  status: ProxyStatus
  latency_ms: number
  last_checked_at?: string
  notes?: string
  assigned_count?: number
  source?: 'custom' | 'official_leased'
  lease_id?: string
  official_proxy_id?: string
  monthly_price_twd?: number
  expires_at?: string
  created_at?: string
  updated_at?: string
}

export type OfficialProxyStatus = 'available' | 'rented_out' | 'maintenance'

export interface OfficialRentableProxy {
  id: string
  name: string
  proxy_type: ProxyType
  protocol: ProxyProtocol
  host: string
  port: number
  username?: string
  password?: string
  country: string
  city?: string
  isp?: string
  latency_ms: number
  monthly_price_twd: number
  max_tenants: number // 1 = 專屬獨享
  current_tenants_count: number
  status: OfficialProxyStatus
  is_active?: boolean
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface ProxyLease {
  id: string
  user_id?: string
  official_proxy_id: string
  status: 'active' | 'expired' | 'canceled'
  rented_at: string
  expires_at: string
  official_proxy?: OfficialRentableProxy
  created_at?: string
  updated_at?: string
}


export type SocialPlatform = 'facebook' | 'instagram' | 'threads' | 'tiktok' | 'dcard' | 'x'
export type AccountStatus = 'warming' | 'mature' | 'cooling' | 'banned' | 'idle'

export interface SocialAccount {
  id: string
  user_id?: string
  platform: SocialPlatform
  account_name: string
  account_handle?: string
  avatar_url?: string
  proxy_id?: string
  warmup_day: number
  status: AccountStatus
  health_score: number
  daily_actions_count: number
  max_daily_actions: number
  target_niches: string[]
  last_action_at?: string
  proxy?: SocialProxy | null
  created_at?: string
  updated_at?: string
}

export interface TargetGroup {
  id: string
  name: string
  platform: SocialPlatform
  category: string
  members_count: string
  strictness: 'low' | 'medium' | 'high'
  url: string
  recommended_strategy: string
}

export interface MatrixCopy {
  id: string
  angle: string
  title: string
  content: string
  hashtags: string[]
  call_to_action: string
  anti_collision_hash: string
}

export interface SocialCampaign {
  id: string
  user_id?: string
  title: string
  industry: string
  core_product: string
  target_audience?: string
  offer?: string
  cta_link?: string
  platforms: SocialPlatform[]
  mode: 'copilot' | 'matrix_auto'
  target_groups: TargetGroup[]
  copies: MatrixCopy[]
  dispatch_status: 'draft' | 'queued' | 'publishing' | 'completed'
  created_at?: string
  updated_at?: string
}

export interface SocialLog {
  id: string
  user_id?: string
  account_id: string
  account_name?: string
  platform?: SocialPlatform
  action_type: 'warmup_scroll' | 'warmup_like' | 'warmup_comment' | 'post_mode_a' | 'post_mode_b'
  details: string
  status: 'success' | 'warning' | 'failed'
  created_at: string
}
