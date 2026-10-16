// AI-GATE 主站 API（/api/connector/*），以裝置 token 驗證
export function createAigate(cfg) {
  const base = cfg.appUrl.replace(/\/$/, '')

  async function call(method, pathname, body) {
    const res = await fetch(`${base}${pathname}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = new Error(data.error || `AI-GATE 回應 ${res.status}`)
      err.status = res.status
      throw err
    }
    return data
  }

  return {
    pair: (code, deviceName) => call('POST', '/api/connector/pair', { code, device_name: deviceName }),
    profiles: () => call('GET', '/api/connector/profiles'),
    saveProfileId: (accountId, adspowerProfileId) =>
      call('PATCH', `/api/connector/profiles/${accountId}`, { adspower_profile_id: adspowerProfileId }),
    claimTasks: () => call('POST', '/api/connector/tasks/claim'),
    reportTask: (taskId, status, result) => call('POST', `/api/connector/tasks/${taskId}`, { status, result }),
  }
}
