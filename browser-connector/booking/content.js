// AI-GATE Booking 讀後台連接器 — content script
// 掛在 admin.booking.com 頁面：定時讀「訂單列表」DOM，抽出訂單 → 傳給背景推送。
// 只讀 DOM、不點擊、不送出任何表單。
//
// ⚠️ 選擇器需要依實際後台版面微調：Booking.com extranet 會改版，下面的選擇器是
//    「起始猜測」。調校步驟見 README。打開列表頁、F12 找到每筆訂單的列元素，
//    對照欄位（單號 / 姓名 / 房型 / 入住 / 退房 / 金額 / 狀態）填入下方 SELECTORS。

const SELECTORS = {
  // 訂單列表每一列（row）。常見為表格 tr，或卡片 div。請改成實際的選擇器。
  row: 'table tbody tr, [data-testid="reservation-row"]',
  // 下列為「相對於 row」的子選擇器；找不到時該欄位留空。
  confirmationId: '[data-testid="reservation-id"], .bui-table__cell--id, td:nth-child(1)',
  guestName: '[data-testid="guest-name"], .guest-name, td:nth-child(2)',
  roomName: '[data-testid="room-name"], .room-name',
  checkIn: '[data-testid="checkin"], .checkin',
  checkOut: '[data-testid="checkout"], .checkout',
  price: '[data-testid="price"], .price',
  guests: '[data-testid="guests"], .guests',
  status: '[data-testid="status"], .status',
};

// 已登出偵測：出現登入表單或導向 account.booking.com/sign-in 等
function looksLoggedOut() {
  const url = location.href;
  if (/\/sign-?in|\/login|account\.booking\.com/i.test(url)) return true;
  if (document.querySelector('input[type="password"]')) return true;
  const bodyText = document.body?.innerText || '';
  if (/(sign in to continue|session (has )?expired|請重新登入|登入以繼續)/i.test(bodyText)) return true;
  return false;
}

function txt(el, sel) {
  if (!sel) return '';
  const node = el.querySelector(sel);
  return (node?.textContent || '').trim();
}

// 把後台各種日期格式盡量轉成 YYYY-MM-DD
function toYmd(s) {
  if (!s) return '';
  const iso = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

function toNumber(s) {
  const n = String(s || '').replace(/[^\d.]/g, '');
  return n ? parseFloat(n) : null;
}

function parseStatus(s) {
  return /取消|cancell?ed/i.test(s) ? 'cancelled' : 'confirmed';
}

function scrape() {
  const rows = Array.from(document.querySelectorAll(SELECTORS.row));
  const out = [];
  for (const row of rows) {
    const confirmation_id = (txt(row, SELECTORS.confirmationId).match(/\d{6,}/) || [''])[0];
    if (!confirmation_id) continue;
    out.push({
      confirmation_id,
      guest_name: txt(row, SELECTORS.guestName) || null,
      room_name: txt(row, SELECTORS.roomName) || null,
      check_in: toYmd(txt(row, SELECTORS.checkIn)),
      check_out: toYmd(txt(row, SELECTORS.checkOut)),
      total_price: toNumber(txt(row, SELECTORS.price)),
      num_guests: toNumber(txt(row, SELECTORS.guests)),
      status: parseStatus(txt(row, SELECTORS.status)),
    });
  }
  return out;
}

let lastSentHash = '';
async function tick() {
  if (looksLoggedOut()) {
    chrome.runtime.sendMessage({ type: 'logged_out' }).catch(() => {});
    return;
  }
  const reservations = scrape();
  if (!reservations.length) return;
  // 只在內容有變時才送，避免重複推送
  const hash = JSON.stringify(reservations);
  if (hash === lastSentHash) return;
  lastSentHash = hash;
  chrome.runtime.sendMessage({ type: 'reservations', reservations }).catch(() => {});
}

// 每 30 秒掃一次；背景保活訊號則重新整理頁面
setInterval(tick, 30_000);
setTimeout(tick, 3_000);

chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg?.type === 'keep_alive') {
    // 溫和保活：若在列表頁就重新整理，刷新 session 並拿到最新訂單
    if (!looksLoggedOut()) location.reload();
    send?.({ ok: true });
  }
  return true;
});
