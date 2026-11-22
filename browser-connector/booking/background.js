// AI-GATE Booking 讀後台連接器 — 背景 service worker
// 職責：(1) 接收 content.js 抓到的訂單，推送到 AI-GATE ingest 端點
//       (2) 保活：定時提醒 content.js 重新整理列表頁，避免 extranet 逾時登出
//       (3) 登出偵測：content.js 回報已登出 → 發系統通知請使用者手動重登
// 唯讀取資料，不自動操作平台。

const DEFAULTS = {
  apiBase: '',        // e.g. https://your-ai-gate-domain
  token: '',          // 配對後取得的裝置 token
  keepAliveMin: 10,   // 保活間隔（分）
};

async function cfg() {
  const s = await chrome.storage.local.get(['apiBase', 'token', 'keepAliveMin']);
  return { ...DEFAULTS, ...s };
}

async function postReservations(reservations) {
  const { apiBase, token } = await cfg();
  if (!apiBase || !token) return { ok: false, error: '尚未設定 API 位址或配對 token' };
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/connector/booking/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reservations }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    title,
    message,
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'reservations' && Array.isArray(msg.reservations) && msg.reservations.length) {
      const r = await postReservations(msg.reservations);
      if (r.ok) {
        const d = r.data || {};
        await chrome.storage.local.set({ lastSync: Date.now(), lastResult: d });
        sendResponse({ ok: true, data: d });
      } else {
        await chrome.storage.local.set({ lastError: r.error, lastErrorAt: Date.now() });
        sendResponse({ ok: false, error: r.error });
      }
    } else if (msg?.type === 'logged_out') {
      notify('Booking 後台已登出', '連接器偵測到 Booking.com 後台已登出，請手動重新登入以繼續同步。');
      await chrome.storage.local.set({ loggedOut: true, loggedOutAt: Date.now() });
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false, error: 'unknown message' });
    }
  })();
  return true; // async
});

// 保活：定時叫 content.js 重新整理列表（溫和保活，不狂刷）
async function setupAlarm() {
  const { keepAliveMin } = await cfg();
  chrome.alarms.create('keepAlive', { periodInMinutes: Math.max(5, keepAliveMin) });
}
chrome.runtime.onInstalled.addListener(setupAlarm);
chrome.runtime.onStartup.addListener(setupAlarm);
chrome.storage.onChanged.addListener(c => { if (c.keepAliveMin) setupAlarm(); });

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'keepAlive') return;
  const tabs = await chrome.tabs.query({ url: 'https://admin.booking.com/*' });
  for (const tab of tabs) {
    if (tab.id != null) chrome.tabs.sendMessage(tab.id, { type: 'keep_alive' }).catch(() => {});
  }
});
