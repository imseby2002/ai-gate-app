import { randomBytes } from 'node:crypto'
import { resolveSelection, toOrderLines } from './cart'
import { mockMenu } from './mock'
import type {
  FtCategory,
  FtChild,
  FtCustomization,
  FtItem,
  FtMemberStatus,
  FtMenu,
  FtOption,
  FtOrderRequest,
  FtOrderResult,
} from './types'

// 只在伺服器端使用：點單機一律經過會員 APP 後端，不直接呼叫 iPOS。
//
// 環境變數：
//   FT_API_BASE_URL   會員 APP 後端網址（未設定 → 假資料模式）
//   FT_KIOSK_DEVICES  JSON：{ "<device_key>": { storeId, storeNo, storeName, userToken } }
//     storeId   會員 APP 的 Store.id（下單 delivery_info.store_id 用）
//     storeNo   iPOS pos_id，也是菜單 item_categories?store_id= 的值
//     userToken 門市帳號登入後的 X-USER-TOKEN

export interface FtDeviceConfig {
  storeId: string
  storeNo: string
  storeName: string
  userToken: string
}

export type FtDevice = { mock: true } | { mock: false; config: FtDeviceConfig }

export class FtError extends Error {
  constructor(public code: string, public status = 502) {
    super(code)
  }
}

function baseUrl() {
  return process.env.FT_API_BASE_URL?.replace(/\/+$/, '') || ''
}

export function resolveDevice(key: string | null): FtDevice | null {
  if (!key) return null
  if (!baseUrl()) return { mock: true }
  let devices: Record<string, FtDeviceConfig> = {}
  try {
    devices = JSON.parse(process.env.FT_KIOSK_DEVICES || '{}')
  } catch {
    return null
  }
  const config = devices[key]
  return config ? { mock: false, config } : null
}

export function deviceKeyFrom(req: Request) {
  return req.headers.get('x-device-key') || new URL(req.url).searchParams.get('key')
}

async function callFt<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init
  let res: Response
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-USER-TOKEN': token } : {}),
        ...headers,
      },
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
    })
  } catch {
    throw new FtError('FT_UNREACHABLE')
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const code = (body && typeof body.error_code === 'string' && body.error_code) || `FT_HTTP_${res.status}`
    throw new FtError(code, res.status === 400 ? 400 : 502)
  }
  return body as T
}

// ── 菜單 ────────────────────────────────────────────────

type Raw = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const arr = (v: unknown) => (Array.isArray(v) ? (v as Raw[]) : [])

function mapOption(o: Raw): FtOption {
  return {
    id: str(o.id),
    item_no: str(o.item_no),
    item_name: str(o.item_name),
    item_type: str(o.item_type) || null,
    list_price: num(o.list_price),
    status: o.status as FtOption['status'],
    sort: num(o.sort),
  }
}

function mapCustomization(g: Raw): FtCustomization {
  return {
    id: str(g.id),
    name: str(g.name),
    min_permitted: g.min_permitted == null ? null : num(g.min_permitted),
    max_permitted: g.max_permitted == null ? null : num(g.max_permitted),
    options: arr(g.options).map(mapOption).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
  }
}

function mapChild(c: Raw): FtChild {
  return {
    id: str(c.id),
    item_no: str(c.item_no),
    item_name: str(c.item_name),
    item_type: str(c.item_type) || null,
    list_price: num(c.list_price),
    active: c.active === false ? false : true,
    sort: num(c.sort),
    customizations: arr(c.customizations).map(mapCustomization),
  }
}

function mapItem(i: Raw): FtItem {
  return {
    id: str(i.id),
    item_no: str(i.item_no),
    item_name: str(i.item_name),
    item_type: str(i.item_type),
    description: str(i.description) || null,
    list_price: num(i.list_price),
    thumbnail: str(i.thumbnail) || null,
    sort: num(i.sort),
    childs: arr(i.childs).map(mapChild).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
    customizations: arr(i.customizations).map(mapCustomization),
  }
}

export async function fetchMenu(device: FtDevice): Promise<FtMenu> {
  if (device.mock) return mockMenu()
  const { config } = device
  const raw = await callFt<Raw[]>(
    `/app/api/v1/item_categories?store_id=${encodeURIComponent(config.storeNo)}`
  )
  const categories: FtCategory[] = arr(raw)
    .map(c => ({
      id: str(c.id),
      category_no: str(c.category_no),
      category_name: str(c.category_name),
      sort: num(c.sort),
      thumbnail: str(c.thumbnail) || null,
      items: arr(c.items).map(mapItem).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
    }))
    .filter(c => c.items.length > 0)
  return { storeName: config.storeName, categories, mock: false }
}

// ── 會員 ────────────────────────────────────────────────

/** check_user 不需登入；沒設密碼的舊會員回 USER_REQUIRE_PASSWORD，也算會員 */
export async function checkMember(device: FtDevice, phone: string): Promise<FtMemberStatus> {
  if (device.mock) return phone.endsWith('0') ? 'not_member' : 'member'
  try {
    await callFt('/app/api/v1/check_user', { method: 'POST', body: JSON.stringify({ data: phone }) })
    return 'member'
  } catch (err) {
    if (err instanceof FtError && err.code === 'USER_REQUIRE_PASSWORD') return 'member'
    if (err instanceof FtError && err.code === 'USER_NOT_FOUND') return 'not_member'
    throw err
  }
}

// ── 下單 ────────────────────────────────────────────────

const DINE_NOTE = { dine_in: 'Kiosk - Ăn tại chỗ', takeaway: 'Kiosk - Mang đi' } as const

interface PaymentMethodRow {
  id: string
  name: string
  method: string
}

interface CheckResponse {
  data: Raw & { order_no: string; amount: number; type_order_time: string }
}

interface BookingResponse {
  data: Raw & { order_no: string; amount: number }
}

export async function placeOrder(device: FtDevice, req: FtOrderRequest): Promise<FtOrderResult> {
  const menu = await fetchMenu(device)
  const now = Date.now()
  const resolved = req.selections.map(s => resolveSelection(menu.categories, s))
  const bad = resolved.find(r => 'error' in r)
  if (bad && 'error' in bad) throw new FtError(bad.error, 400)
  const ok = resolved as Exclude<(typeof resolved)[number], { error: string }>[]
  if (ok.length === 0) throw new FtError('CART_EMPTY', 400)

  if (device.mock) {
    return {
      orderNo: randomBytes(4).toString('hex').toUpperCase(),
      amount: ok.reduce((s, r) => s + r.lineTotal, 0),
      mock: true,
    }
  }

  const { config } = device
  const items = ok.flatMap((r, i) => toOrderLines(r, now + i))

  const methods = await callFt<{ data: PaymentMethodRow[] }>('/api/v1.0/payment_methods')
  const cash = methods.data.find(m => m.method === 'CASH')
  if (!cash) throw new FtError('CASH_METHOD_NOT_FOUND')

  const phone = req.phone || ''
  const check = await callFt<CheckResponse>('/api/v1.0/order/check', {
    method: 'POST',
    token: config.userToken,
    body: JSON.stringify({
      order_type: 'PICK',
      time_order_type: 'now',
      delivery_info: {
        store_id: config.storeId,
        time_order: Math.floor(now / 1000),
        contact_phone: phone,
        contact_name: '',
      },
      vouchers: [],
      note: DINE_NOTE[req.dineOption],
      items,
      payment_methods: [{ method_id: cash.id, method: cash.method, name: cash.name, amount: 0 }],
    }),
  })

  const booking = await callFt<BookingResponse>('/api/v1.0/order/booking', {
    method: 'POST',
    token: config.userToken,
    body: JSON.stringify({ ...check.data, time_order_type: check.data.type_order_time }),
  })

  return { orderNo: booking.data.order_no, amount: booking.data.amount, mock: false }
}
