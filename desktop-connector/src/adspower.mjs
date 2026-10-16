// AdsPower Local API 用戶端（v2 browser-profile；群組為 v1）。
// 路徑與欄位依 AdsPower 官方 local-api-mcp-typescript（packages/core/src/constants/localApiContracts.ts、types/schemas.ts）。
// Local API 限制每秒 1 次請求，這裡排隊送出。

const MIN_INTERVAL_MS = 1100

export function createAdsPower(cfg) {
  const base = cfg.adspowerUrl.replace(/\/$/, '')
  let last = 0
  let queue = Promise.resolve()

  function call(method, pathname, body) {
    const run = async () => {
      const wait = last + MIN_INTERVAL_MS - Date.now()
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
      last = Date.now()
      let res
      try {
        res = await fetch(`${base}${pathname}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(cfg.adspowerApiKey ? { Authorization: `Bearer ${cfg.adspowerApiKey}` } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        })
      } catch {
        throw new Error(`連不到 AdsPower（${base}），請確認 AdsPower 已開啟並啟用 Local API`)
      }
      const data = await res.json().catch(() => ({}))
      if (data.code !== 0) throw new Error(`AdsPower：${data.msg || `HTTP ${res.status}`}`)
      return data.data
    }
    const p = queue.then(run, run)
    queue = p.catch(() => {})
    return p
  }

  return {
    status: () => call('GET', '/status'),
    listGroups: () => call('GET', '/api/v1/group/list?page=1&page_size=100'),
    createGroup: name => call('POST', '/api/v1/group/create', { group_name: name }),
    createProfile: body => call('POST', '/api/v2/browser-profile/create', body),
    updateProfile: body => call('POST', '/api/v2/browser-profile/update', body),
    startProfile: profileId => call('POST', '/api/v2/browser-profile/start', { profile_id: profileId }),
    stopProfile: profileId => call('POST', '/api/v2/browser-profile/stop', { profile_id: profileId }),
  }
}

const PLATFORM_DOMAINS = {
  facebook: 'facebook.com',
  instagram: 'instagram.com',
  threads: 'threads.net',
  tiktok: 'tiktok.com',
  dcard: 'dcard.tw',
  x: 'x.com',
}

/** AI-GATE 代理 → AdsPower user_proxy_config */
export function toProxyConfig(proxy) {
  if (!proxy?.host || !proxy?.port) return { proxy_soft: 'no_proxy' }
  return {
    proxy_soft: 'other',
    proxy_type: ['http', 'https', 'socks5'].includes(proxy.protocol) ? proxy.protocol : 'http',
    proxy_host: String(proxy.host),
    proxy_port: String(proxy.port),
    ...(proxy.username ? { proxy_user: String(proxy.username) } : {}),
    ...(proxy.password ? { proxy_password: String(proxy.password) } : {}),
  }
}

export function profileFields(account) {
  const domain = PLATFORM_DOMAINS[account.platform]
  return {
    name: `AI-GATE ${account.platform} ${account.account_name}`.slice(0, 100),
    remark: `AI-GATE 帳號 ${account.id}`,
    ...(domain ? { platform: domain, tabs: [`https://www.${domain}/`] } : {}),
  }
}

/** 建立時一律帶代理設定；更新時帳號沒綁代理就不覆蓋 AdsPower 內手動設定的代理 */
export function createFields(account) {
  return { ...profileFields(account), user_proxy_config: toProxyConfig(account.proxy) }
}

export function updateFields(account) {
  return { ...profileFields(account), ...(account.proxy?.host ? { user_proxy_config: toProxyConfig(account.proxy) } : {}) }
}
