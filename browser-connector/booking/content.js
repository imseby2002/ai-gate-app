// AI-GATE 讀後台連接器 — content script（多平台）
// 掛在各 OTA 後台頁面：定時讀「訂單列表」DOM，抽出訂單 → 傳給背景推送。
// 只讀 DOM、不點擊、不送出任何表單。
//
// ⚠️ 每個平台的 SELECTORS 需要依實際後台版面微調（會改版）。調校步驟見 README：
//    打開列表頁 F12，找到每筆訂單的列元素與各欄位，填入對應平台的選擇器。

// 依網域判斷目前在哪個平台
function detectPlatform() {
  const h = location.hostname;
  if (h.includes('booking.com')) return 'booking_com';
  if (h.includes('agoda.com')) return 'agoda';
  if (h.includes('trip.com') || h.includes('ctrip.com')) return 'trip_com';
  if (h.includes('asiayo.com')) return 'asiayo';
  if (h.includes('expediapartnercentral.com')) return 'expedia';
  return null;
}

// 各平台的選擇器（起始猜測，需調校）。row 之下的子選擇器找不到就留空。
const PLATFORM_SELECTORS = {
  booking_com: {
    row: 'table tbody tr, [data-testid="reservation-row"]',
    confirmationId: '[data-testid="reservation-id"], td:nth-child(1)',
    guestName: '[data-testid="guest-name"], td:nth-child(2)',
    roomName: '[data-testid="room-name"]',
    checkIn: '[data-testid="checkin"]',
    checkOut: '[data-testid="checkout"]',
    price: '[data-testid="price"]',
    guests: '[data-testid="guests"]',
    status: '[data-testid="status"]',
  },
  agoda: {
    row: 'table tbody tr',
    confirmationId: 'td:nth-child(1)',
    guestName: 'td:nth-child(2)',
    roomName: 'td:nth-child(3)',
    checkIn: 'td:nth-child(4)',
    checkOut: 'td:nth-child(5)',
    price: 'td:nth-child(6)',
    guests: '',
    status: 'td:last-child',
  },
  trip_com: {
    row: 'table tbody tr',
    confirmationId: 'td:nth-child(1)',
    guestName: 'td:nth-child(2)',
    roomName: 'td:nth-child(3)',
    checkIn: 'td:nth-child(4)',
    checkOut: 'td:nth-child(5)',
    price: 'td:nth-child(6)',
    guests: '',
    status: 'td:last-child',
  },
  asiayo: {
    row: 'table tbody tr',
    confirmationId: 'td:nth-child(1)',
    guestName: 'td:nth-child(2)',
    roomName: 'td:nth-child(3)',
    checkIn: 'td:nth-child(4)',
    checkOut: 'td:nth-child(5)',
    price: 'td:nth-child(6)',
    guests: '',
    status: 'td:last-child',
  },
  expedia: {
    row: 'table tbody tr',
    confirmationId: 'td:nth-child(1)',
    guestName: 'td:nth-child(2)',
    roomName: 'td:nth-child(3)',
    checkIn: 'td:nth-child(4)',
    checkOut: 'td:nth-child(5)',
    price: 'td:nth-child(6)',
    guests: '',
    status: 'td:last-child',
  },
};

const PLATFORM = detectPlatform();
const SELECTORS = PLATFORM ? PLATFORM_SELECTORS[PLATFORM] : null;

function looksLoggedOut() {
  const url = location.href;
  if (/\/sign-?in|\/login|\/account\/|auth/i.test(url)) return true;
  if (document.querySelector('input[type="password"]')) return true;
  const bodyText = document.body?.innerText || '';
  if (/(sign in to continue|session (has )?expired|log ?in|請重新登入|登入以繼續|重新登录)/i.test(bodyText)
      && document.querySelector('input[type="password"], button[type="submit"]')) return true;
  return false;
}

function txt(el, sel) {
  if (!sel) return '';
  const node = el.querySelector(sel);
  return (node?.textContent || '').trim();
}

function toYmd(s) {
  if (!s) return '';
  const iso = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}
function toNumber(s) { const n = String(s || '').replace(/[^\d.]/g, ''); return n ? parseFloat(n) : null; }
function parseStatus(s) { return /取消|取消|cancell?ed|退订/i.test(s) ? 'cancelled' : 'confirmed'; }

function scrape() {
  if (!SELECTORS) return [];
  const rows = Array.from(document.querySelectorAll(SELECTORS.row));
  const out = [];
  for (const row of rows) {
    const confirmation_id = (txt(row, SELECTORS.confirmationId).match(/[A-Za-z]?\d{6,}/) || [''])[0];
    if (!confirmation_id) continue;
    out.push({
      platform: PLATFORM,
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
  if (!PLATFORM) return;
  if (looksLoggedOut()) {
    chrome.runtime.sendMessage({ type: 'logged_out', platform: PLATFORM }).catch(() => {});
    return;
  }
  const reservations = scrape();
  if (!reservations.length) return;
  const hash = JSON.stringify(reservations);
  if (hash === lastSentHash) return;
  lastSentHash = hash;
  chrome.runtime.sendMessage({ type: 'reservations', platform: PLATFORM, reservations }).catch(() => {});
}

setInterval(tick, 30_000);
setTimeout(tick, 3_000);

chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg?.type === 'keep_alive') {
    if (!looksLoggedOut()) location.reload();
    send?.({ ok: true });
  }
  return true;
});
