// GEO 發佈設定：跟著「目前切換的公司」走，存在公司 owner 名下；公司還沒有設定時沿用登入者自己舊的設定
import type { MktCompany } from '@/lib/marketing/company'

const SETTINGS_COLS = 'user_id, wp_base_url, wp_user, wp_app_password, webhook_url, webhook_token, platforms'

export async function loadGeoSettings(mkt: MktCompany) {
  const { data, error } = await mkt.admin.from('geo_publish_settings').select(SETTINGS_COLS)
    .in('user_id', [...new Set([mkt.ownerId, mkt.userId])])
  if (error) console.error('[geo/settings] 讀取失敗', error)
  const rows = data ?? []
  return rows.find(r => r.user_id === mkt.ownerId) ?? rows.find(r => r.user_id === mkt.userId) ?? null
}
