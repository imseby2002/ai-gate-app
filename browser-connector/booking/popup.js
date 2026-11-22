const $ = id => document.getElementById(id);
const statusEl = $('status');
function setStatus(msg, cls) { statusEl.textContent = msg; statusEl.className = 'muted ' + (cls || ''); }

async function load() {
  const s = await chrome.storage.local.get(['apiBase', 'keepAliveMin', 'token', 'lastSync', 'lastResult', 'lastError', 'loggedOut']);
  $('apiBase').value = s.apiBase || '';
  $('keepAliveMin').value = s.keepAliveMin || 10;
  const bits = [];
  if (s.token) bits.push('已配對 ✓'); else bits.push('尚未配對');
  if (s.loggedOut) bits.push('⚠️ 後台已登出，請重登');
  if (s.lastSync) {
    const r = s.lastResult || {};
    bits.push(`上次同步 ${new Date(s.lastSync).toLocaleTimeString()}：新增 ${r.created ?? 0}・更新 ${r.updated ?? 0}・取消 ${r.cancelled ?? 0}`);
  }
  if (s.lastError) bits.push('錯誤：' + s.lastError);
  setStatus(bits.join('\n'), s.token ? 'ok' : '');
}

$('save').onclick = async () => {
  await chrome.storage.local.set({
    apiBase: $('apiBase').value.trim(),
    keepAliveMin: Math.max(5, parseInt($('keepAliveMin').value) || 10),
  });
  setStatus('設定已儲存', 'ok');
};

$('pair').onclick = async () => {
  const apiBase = $('apiBase').value.trim();
  const code = $('pairCode').value.trim();
  if (!apiBase) return setStatus('請先填 AI-GATE 網址', 'err');
  if (!code) return setStatus('請輸入配對碼', 'err');
  setStatus('配對中…');
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/connector/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, device_name: 'Booking 讀後台外掛' }),
    });
    const data = await res.json();
    if (!res.ok || !data.token) return setStatus('配對失敗：' + (data.error || res.status), 'err');
    await chrome.storage.local.set({ apiBase, token: data.token, loggedOut: false });
    setStatus('配對成功 ✓', 'ok');
    load();
  } catch (e) {
    setStatus('配對失敗：' + e, 'err');
  }
};

load();
