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

// 取得目前作用中的 OTA 分頁
async function otaTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/admin\.booking\.com|ycs\.agoda\.com|ebooking\.trip\.com|ctrip\.com|asiayo\.com|expediapartnercentral\.com/.test(tab.url || '')) return null;
  return tab;
}
async function ask(type) {
  const tab = await otaTab();
  if (!tab) { setStatus('請先切到該平台後台的訂單頁再操作', 'err'); return null; }
  try { return await chrome.tabs.sendMessage(tab.id, { type }); }
  catch (e) { setStatus('無法連到後台分頁，請重新整理該頁再試', 'err'); return null; }
}

if ($('capture')) $('capture').onclick = async () => {
  setStatus('擷取中…');
  const r = await ask('capture_push');
  if (!r) return;
  if (!r.parsed) setStatus(`在此頁未解析到訂單（可能需要匯出樣本回報校準）。平台：${r.platform || '未知'}`, 'err');
  else setStatus(`解析到 ${r.parsed} 筆，已推送 ${r.pushed} 筆（平台：${r.platform}）`, 'ok');
  setTimeout(load, 1200);
};

if ($('export')) $('export').onclick = async () => {
  setStatus('匯出樣本中…');
  const r = await ask('capture_export');
  if (!r) return;
  const blob = new Blob([JSON.stringify({ platform: r.platform, parsed: r.parsed, capturedAt: new Date().toISOString(), sample: r.sample }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `aigate-sample-${r.platform || 'unknown'}-${Date.now()}.json`;
  a.click(); URL.revokeObjectURL(url);
  setStatus(`已下載樣本（解析到 ${r.parsed} 筆）。把檔案回報給開發者校準即可。`, 'ok');
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
