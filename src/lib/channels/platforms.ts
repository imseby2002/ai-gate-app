// 官方帳號的平台與模組定義（前後端共用）。
// 欄位 key 沿用客服頻道設定（social_platform_credentials）的命名，之後搬移舊設定可直接對應。

export interface ChannelField {
  key: string
  label: string
  secret: boolean
  /** 選填欄位（例如自動更新權杖用） */
  optional?: boolean
}

export interface ChannelPlatform {
  id: string
  name: string
  color: string
  docUrl: string
  /** 判斷「已連線」所需的欄位 */
  required: string[]
  fields: ChannelField[]
}

export const CHANNEL_PLATFORMS: ChannelPlatform[] = [
  {
    id: 'zalo_oa', name: 'Zalo OA', color: '#0068FF',
    docUrl: 'https://developers.zalo.me/docs/official-account',
    required: ['zalo_oa_access_token'],
    fields: [
      { key: 'zalo_oa_access_token', label: 'OA Access Token', secret: true },
      { key: 'zalo_app_id', label: 'App ID', secret: false, optional: true },
      { key: 'zalo_secret_key', label: 'Secret Key', secret: true, optional: true },
      { key: 'zalo_refresh_token', label: 'Refresh Token', secret: true, optional: true },
      { key: 'zns_template_id', label: 'ZNS Template ID', secret: false, optional: true },
      { key: 'zalo_oa_id', label: 'OA ID', secret: false, optional: true },
    ],
  },
  {
    id: 'line_oa', name: 'LINE Official Account', color: '#00B900',
    docUrl: 'https://developers.line.biz/en/docs/messaging-api/getting-started/',
    required: ['line_channel_access_token', 'line_channel_secret'],
    fields: [
      { key: 'line_channel_access_token', label: 'Channel Access Token', secret: true },
      { key: 'line_channel_secret', label: 'Channel Secret', secret: true },
    ],
  },
  {
    id: 'whatsapp_business', name: 'WhatsApp Business', color: '#25D366',
    docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    required: ['whatsapp_phone_number_id', 'whatsapp_access_token'],
    fields: [
      { key: 'whatsapp_phone_number_id', label: 'Phone Number ID', secret: false },
      { key: 'whatsapp_access_token', label: 'Access Token', secret: true },
      { key: 'whatsapp_verify_token', label: 'Verify Token', secret: false, optional: true },
      { key: 'whatsapp_app_secret', label: 'App Secret', secret: true, optional: true },
    ],
  },
  {
    id: 'messenger', name: 'Facebook Page / Messenger', color: '#0084FF',
    docUrl: 'https://developers.facebook.com/docs/messenger-platform/getting-started',
    required: ['fb_page_access_token'],
    fields: [
      { key: 'fb_page_access_token', label: 'Page Access Token', secret: true },
      { key: 'fb_page_id', label: 'Page ID', secret: false, optional: true },
      { key: 'fb_verify_token', label: 'Verify Token', secret: false, optional: true },
      { key: 'fb_app_secret', label: 'App Secret', secret: true, optional: true },
    ],
  },
  {
    id: 'instagram', name: 'Instagram', color: '#E1306C',
    docUrl: 'https://developers.facebook.com/docs/messenger-platform/instagram',
    required: ['ig_access_token'],
    fields: [
      { key: 'ig_access_token', label: 'Access Token', secret: true },
      { key: 'ig_user_id', label: 'IG User ID', secret: false, optional: true },
      { key: 'ig_verify_token', label: 'Verify Token', secret: false, optional: true },
      { key: 'ig_app_secret', label: 'App Secret', secret: true, optional: true },
    ],
  },
  {
    id: 'telegram', name: 'Telegram Bot', color: '#2AABEE',
    docUrl: 'https://core.telegram.org/bots/tutorial',
    required: ['telegram_bot_token'],
    fields: [
      { key: 'telegram_bot_token', label: 'Bot Token', secret: true },
      { key: 'telegram_admin_chat_id', label: 'Admin Chat ID', secret: false, optional: true },
    ],
  },
]

export const CHANNEL_PLATFORM_MAP = Object.fromEntries(CHANNEL_PLATFORMS.map(p => [p.id, p])) as Record<string, ChannelPlatform>

// 使用官方帳號的模組；units 為 profiles.units 中代表該模組的鍵（模組負責人判斷用）
export const CHANNEL_MODULES = [
  { id: 'cs', units: ['cs'] },
  { id: 'marketing', units: ['marketing', 'mkt'] },
  { id: 'hr', units: ['hr'] },
  { id: 'affairs', units: ['affairs'] },
] as const

export type ChannelModuleId = (typeof CHANNEL_MODULES)[number]['id']

export function isChannelModule(v: unknown): v is ChannelModuleId {
  return typeof v === 'string' && CHANNEL_MODULES.some(m => m.id === v)
}
