const MENU_KEY = 'pos_menu_cache'
const QUEUE_KEY = 'pos_order_queue'

export interface CachedMenu {
  revision: number
  store_id: string
  store_name: string
  terminal_id: string
  categories: unknown[]
  items: unknown[]
  cached_at: string
}

export function cacheMenu(data: CachedMenu) {
  localStorage.setItem(MENU_KEY, JSON.stringify(data))
}

export function loadCachedMenu(): CachedMenu | null {
  try {
    const raw = localStorage.getItem(MENU_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export interface QueuedOrder {
  client_id: string
  payload: Record<string, unknown>
  created_at: string
  retries: number
}

export function queueOrder(clientId: string, payload: Record<string, unknown>) {
  const q = loadQueue()
  if (q.some(o => o.client_id === clientId)) return
  q.push({ client_id: clientId, payload, created_at: new Date().toISOString(), retries: 0 })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function loadQueue(): QueuedOrder[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveQueue(q: QueuedOrder[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export async function syncMenu(deviceKey: string, since = 0) {
  const res = await fetch(`/api/pos/sync/menu?since=${since}`, {
    headers: { 'x-terminal-key': deviceKey },
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  if (data.changed) {
    cacheMenu({
      revision: data.revision,
      store_id: data.store_id,
      store_name: data.store_name,
      terminal_id: data.terminal_id,
      categories: data.categories,
      items: data.items,
      cached_at: new Date().toISOString(),
    })
  } else if (since > 0) {
    const cached = loadCachedMenu()
    if (cached) return { ...data, ...cached, changed: false }
  }
  return data
}

export async function pushOrder(deviceKey: string, payload: Record<string, unknown>) {
  const res = await fetch('/api/pos/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-terminal-key': deviceKey },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function flushOrderQueue(deviceKey: string) {
  const q = loadQueue()
  const remain: QueuedOrder[] = []
  for (const o of q) {
    try {
      await pushOrder(deviceKey, o.payload)
    } catch {
      remain.push({ ...o, retries: o.retries + 1 })
    }
  }
  saveQueue(remain)
  return { synced: q.length - remain.length, pending: remain.length }
}
