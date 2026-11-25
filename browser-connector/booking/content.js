// AI-GATE 讀後台連接器 — content script（API 攔截版）
// 原理：各 OTA 後台是 SPA，訂單資料由前端打內部 JSON API 取得。此腳本在頁面注入
// inject.js 攔截那些 API 回應（唯讀），用通用啟發式從 JSON 找出訂單 → 推送到 AI-GATE。
// 完全不爬畫面、不改請求、不送表單。改版時若解析失敗，popup 可「匯出樣本」回報給開發者校準。

function detectPlatform() {
  const h = location.hostname;
  if (h.includes('booking.com')) return 'booking_com';
  if (h.includes('agoda.com')) return 'agoda';
  if (h.includes('trip.com') || h.includes('ctrip.com')) return 'trip_com';
  if (h.includes('asiayo.com')) return 'asiayo';
  if (h.includes('expediapartnercentral.com')) return 'expedia';
  return null;
}
const PLATFORM = detectPlatform();

// 注入頁面環境攔截器
try {
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('inject.js');
  (document.head || document.documentElement).appendChild(s);
  s.onload = () => s.remove();
} catch (e) {}

// 最近擷取的 API 回應（環形緩衝，供解析與匯出樣本）
const MAX_BUF = 60;
const buffer = []; // { url, body, at }

window.addEventListener('message', ev => {
  const d = ev.data;
  if (!d || d.__aigate !== 'aigate-capture') return;
  buffer.push({ url: d.url, body: d.body, at: Date.now() });
  while (buffer.length > MAX_BUF) buffer.shift();
  scheduleParse();
});

// ───────── 解析規則：內建預設，啟動時向 AI-GATE 抓最新（平台改版免重載外掛）─────────
const DEFAULT_RULES = {
  version: 0,
  field: {
    id: '(reservation|booking|confirmation|order)[_\\s]*(id|no|number|code)|^id$|reserveid|resid',
    name: 'guest.*name|customer.*name|booker|travel|contact.*name|^name$|guestname',
    room: 'room.*(name|type)|roomtype|room_?name|unit.*name|property.*name|accommodation',
    checkin: 'check.?in|arrival|arrivaldate|start.*date|from.*date|checkindate|date.*in',
    checkout: 'check.?out|depart|departure|end.*date|to.*date|checkoutdate|date.*out',
    price: 'total.*(price|amount|rate|charge)|grand.*total|amount|price|revenue|payout|totalprice',
    guests: 'guest.*(count|number|qty)|occupancy|adults|persons|pax|num.*guest|numguests',
    status: 'status|state|cancell|reservationstatus',
  },
  cancel: '取消|cancel|退订|退訂|refund|void',
  idShape: '[A-Za-z]?\\d{6,}',
};

let FIELD = {};
let reCancel = /取消|cancel|退订|退訂|refund/i;
let reIdShape = /[A-Za-z]?\d{6,}/;
function applyRules(rules) {
  try {
    const f = rules.field || {};
    FIELD = {
      id: new RegExp(f.id, 'i'), name: new RegExp(f.name, 'i'), room: new RegExp(f.room, 'i'),
      checkin: new RegExp(f.checkin, 'i'), checkout: new RegExp(f.checkout, 'i'),
      price: new RegExp(f.price, 'i'), guests: new RegExp(f.guests, 'i'), status: new RegExp(f.status, 'i'),
    };
    reCancel = new RegExp(rules.cancel, 'i');
    reIdShape = new RegExp(rules.idShape);
  } catch (e) { applyRules(DEFAULT_RULES); }
}
applyRules(DEFAULT_RULES);

// 從伺服器抓規則（apiBase 來自 popup 設定），成功即覆蓋並快取；失敗用快取或預設。
async function loadRules() {
  try {
    const s = await chrome.storage.local.get(['apiBase', 'rulesCache']);
    if (s.rulesCache && s.rulesCache.field) applyRules(s.rulesCache);
    if (!s.apiBase) return;
    const res = await fetch(`${s.apiBase.replace(/\/$/, '')}/api/connector/booking/rules`, { cache: 'no-store' });
    if (!res.ok) return;
    const rules = await res.json();
    if (rules && rules.field) { applyRules(rules); chrome.storage.local.set({ rulesCache: rules }).catch(() => {}); }
  } catch (e) {}
}
loadRules();

const reDate = /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/;
const looksDate = v => typeof v === 'string' && reDate.test(v);
function toYmd(v) {
  if (v == null) return '';
  const s = String(v);
  const m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}
function toNum(v) { const n = String(v ?? '').replace(/[^\d.]/g, ''); return n ? parseFloat(n) : null; }
// 在一個物件（可含一層巢狀）裡依欄位名找值
function findField(obj, re, depth = 2) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (re.test(k) && (v == null || typeof v !== 'object')) return v;
  }
  if (depth > 0) for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const r = findField(v, re, depth - 1);
      if (r !== undefined) return r;
    }
  }
  return undefined;
}
function objHasReservationShape(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  const ci = findField(o, FIELD.checkin);
  const co = findField(o, FIELD.checkout);
  const hasDate = looksDate(ci) || looksDate(co);
  const id = findField(o, FIELD.id);
  const name = findField(o, FIELD.name);
  return hasDate && (id != null || name != null);
}
// 房型名稱：先直接找；找不到再找巢狀陣列（如 Booking 的 rooms[].name、roomReservations[].roomType）
function findRoomName(o) {
  const direct = findField(o, FIELD.room);
  if (direct != null && String(direct).trim()) return direct;
  for (const k of Object.keys(o)) {
    if (/room|unit|accommodation/i.test(k) && Array.isArray(o[k]) && o[k].length) {
      const el = o[k][0];
      if (el && typeof el === 'object') {
        const rn = findField(el, FIELD.room) ?? el.name ?? el.roomName ?? el.type;
        if (rn != null && String(rn).trim()) return rn;
      } else if (typeof el === 'string' && el.trim()) return el;
    }
  }
  return undefined;
}
// 金額：排除佣金/稅費,優先總額欄位,物件取其 amount/value/formatted；候選取最大(通常是總額)。
function moneyOf(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v || null;
  if (typeof v === 'object') return moneyOf(v.amount ?? v.value ?? v.total ?? v.formatted);
  const n = String(v).replace(/[^\d.]/g, ''); return n ? parseFloat(n) : null;
}
const reBadMoney = /commission|fee|tax|佣金|手續|服務費|gap|discount|deposit|refund|markup|per.?night|dailyrate/i;
const rePreferMoney = /total.*(price|amount|rate|charge)|grand.?total|totalprice|order.?amount|sellinclusive|inclusive|^price$|^amount$|^total$|totalsaleprice|totalcostprice/i;
function findPrice(o) {
  const cands = [];
  (function walk(node, depth) {
    if (!node || typeof node !== 'object' || depth > 3) return;
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (reBadMoney.test(k)) continue; // 跳過佣金/稅費整個子樹
      if (rePreferMoney.test(k)) { const n = moneyOf(v); if (n) cands.push(n); }
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, depth + 1);
    }
  })(o, 0);
  if (cands.length) return Math.max(...cands);
  const fb = findField(o, FIELD.price); return moneyOf(fb);
}
function normalize(o) {
  const ci = toYmd(findField(o, FIELD.checkin));
  if (!ci) return null;
  let co = toYmd(findField(o, FIELD.checkout));
  if (!co || co <= ci) co = new Date(new Date(ci).getTime() + 86400000).toISOString().slice(0, 10);
  const idRaw = findField(o, FIELD.id);
  const confirmation_id = (String(idRaw ?? '').match(reIdShape) || [''])[0];
  if (!confirmation_id) return null;
  const statusRaw = String(findField(o, FIELD.status) ?? '');
  const name = findField(o, FIELD.name);
  const room = findRoomName(o);
  return {
    platform: PLATFORM,
    confirmation_id,
    guest_name: (name != null ? String(name).trim() : '') || null,
    room_name: (room != null ? String(room).trim() : '') || null,
    check_in: ci,
    check_out: co,
    total_price: findPrice(o),
    num_guests: toNum(findField(o, FIELD.guests)),
    status: reCancel.test(statusRaw) ? 'cancelled' : 'confirmed',
  };
}
// 深走 JSON，找出所有「像訂單的物件」
function walk(node, out, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return;
  if (Array.isArray(node)) {
    for (const o of node) { if (objHasReservationShape(o)) { const n = normalize(o); if (n) out.push(n); } }
    for (const v of node) walk(v, out, depth + 1);
  } else {
    if (objHasReservationShape(node)) { const n = normalize(node); if (n) out.push(n); }
    for (const k of Object.keys(node)) walk(node[k], out, depth + 1);
  }
}
function extractAll() {
  const out = [];
  for (const item of buffer) { try { walk(item.body, out); } catch (e) {} }
  const map = new Map();
  for (const r of out) map.set(r.confirmation_id, r); // 去重，保留最後
  return [...map.values()];
}

// ───────── 自動推送（去重、節流）─────────
let parseTimer = null;
let sentKeys = new Set();
function scheduleParse() {
  clearTimeout(parseTimer);
  parseTimer = setTimeout(() => pushNew(false), 2500);
}
function pushNew(force) {
  const all = extractAll();
  chrome.storage.local.set({ [`parsed_${PLATFORM}`]: all.length, [`parsedAt_${PLATFORM}`]: Date.now() }).catch(() => {});
  if (force) sentKeys = new Set();
  const fresh = all.filter(r => !sentKeys.has(r.confirmation_id + '|' + r.status));
  if (!fresh.length) return 0;
  fresh.forEach(r => sentKeys.add(r.confirmation_id + '|' + r.status));
  chrome.runtime.sendMessage({ type: 'reservations', platform: PLATFORM, reservations: fresh }).catch(() => {});
  return fresh.length;
}

// ───────── 與 popup 溝通：手動擷取 / 匯出樣本 / 保活 ─────────
chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg?.type === 'capture_push') {
    const n = pushNew(true);
    send?.({ ok: true, platform: PLATFORM, parsed: extractAll().length, pushed: n });
  } else if (msg?.type === 'capture_export') {
    const sample = buffer.slice(-30).map(b => ({ url: b.url, body: b.body }));
    send?.({ ok: true, platform: PLATFORM, parsed: extractAll().length, sample });
  } else if (msg?.type === 'keep_alive') {
    loadRules();
    if (!looksLoggedOut()) location.reload();
    send?.({ ok: true });
  }
  return true;
});

function looksLoggedOut() {
  if (/\/sign-?in|\/login|auth/i.test(location.href)) return true;
  if (document.querySelector('input[type="password"]')) return true;
  return false;
}
setInterval(() => {
  if (PLATFORM && looksLoggedOut()) chrome.runtime.sendMessage({ type: 'logged_out', platform: PLATFORM }).catch(() => {});
}, 30_000);
