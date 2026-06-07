// AI Gate PWA Service Worker
// 管理後台資料需即時，故不快取 API/動態內容，僅啟用安裝能力。
const VERSION = 'v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // 直接走網路，確保訂單/入住/客服資料永遠最新
  // 此 handler 存在即可讓瀏覽器判定為可安裝 PWA
  return
})
