import type {
  FtCategory,
  FtChild,
  FtCustomization,
  FtItem,
  FtLocale,
  FtOption,
  FtOrderLine,
  FtSelection,
  FtTranslations,
} from './types'

export function isOptionActive(o: FtOption) {
  return o.status !== false && o.status !== 'DEACTIVE'
}

export function findItem(categories: FtCategory[], itemId: string): FtItem | undefined {
  for (const c of categories) {
    const hit = c.items.find(i => i.id === itemId)
    if (hit) return hit
  }
  return undefined
}

export function activeChilds(item: FtItem): FtChild[] {
  return (item.childs ?? []).filter(c => c.active !== false && c.item_name)
}

/** 有選 size 時用 size 的加料；size 沒設定就退回主商品的加料 */
export function customizationsFor(item: FtItem, child?: FtChild | null): FtCustomization[] {
  const fromChild = child?.customizations ?? []
  const groups = fromChild.length > 0 ? fromChild : item.customizations ?? []
  return groups
    .map(g => ({ ...g, options: g.options.filter(isOptionActive) }))
    .filter(g => g.options.length > 0)
}

export function groupMax(g: FtCustomization) {
  return g.max_permitted && g.max_permitted > 0 ? g.max_permitted : g.options.length
}

export function groupMin(g: FtCustomization) {
  return g.min_permitted && g.min_permitted > 0 ? g.min_permitted : 0
}

export interface ResolvedSelection {
  item: FtItem
  child: FtChild | null
  options: FtOption[]
  qty: number
  note: string
  unitPrice: number
  lineTotal: number
}

/** 依菜單驗證並計價；選項不存在或不符 min/max 就回傳錯誤訊息 */
export function resolveSelection(
  categories: FtCategory[],
  sel: FtSelection
): ResolvedSelection | { error: string } {
  const item = findItem(categories, sel.itemId)
  if (!item) return { error: 'ITEM_NOT_FOUND' }
  if (!Number.isInteger(sel.qty) || sel.qty < 1 || sel.qty > 50) return { error: 'QTY_INVALID' }

  const childs = activeChilds(item)
  let child: FtChild | null = null
  if (childs.length > 0) {
    child = childs.find(c => c.id === sel.childId) ?? null
    if (!child) return { error: 'SIZE_REQUIRED' }
  }

  const groups = customizationsFor(item, child)
  const options: FtOption[] = []
  for (const g of groups) {
    const picked = g.options.filter(o => sel.optionIds.includes(o.id))
    if (picked.length < groupMin(g) || picked.length > groupMax(g)) return { error: 'OPTION_INVALID' }
    options.push(...picked)
  }
  if (options.length !== new Set(sel.optionIds).size) return { error: 'OPTION_INVALID' }

  const base = child ? child.list_price : item.list_price
  const unitPrice = base + options.reduce((s, o) => s + o.list_price, 0)
  return {
    item,
    child,
    options,
    qty: sel.qty,
    note: (sel.note ?? '').slice(0, 100),
    unitPrice,
    lineTotal: unitPrice * sel.qty,
  }
}

/**
 * 轉成會員 APP 下單格式（照舊網頁版 ToppingModal2 的拆行方式）：
 * - 有 size：主商品一行（價格 0、is_send_pos=false），size 一行（parent=主商品）
 * - 加料：parent = size 或主商品
 * - 同一杯的每一行共用 time_choose，quantity 都是杯數
 */
export function toOrderLines(r: ResolvedSelection, timeChoose: number): FtOrderLine[] {
  const { item, child, options, qty, note } = r
  const lines: FtOrderLine[] = []
  const base = {
    quantity: qty,
    time_choose: timeChoose,
    thumbnail: item.thumbnail ?? '',
  }

  lines.push({
    ...base,
    id: item.id,
    item_no: item.item_no,
    item_name: item.item_name,
    item_type: item.item_type,
    price_list: child ? 0 : item.list_price,
    parent_id: '',
    note: child ? undefined : note || undefined,
    is_send_pos: !child,
  })

  if (child) {
    lines.push({
      ...base,
      id: child.id,
      item_no: child.item_no,
      item_name: child.item_name,
      item_type: child.item_type ?? item.item_type,
      price_list: child.list_price,
      parent_id: item.id,
      note: note || undefined,
      is_send_pos: true,
    })
  }

  for (const o of options) {
    lines.push({
      ...base,
      id: o.id,
      item_no: o.item_no,
      item_name: o.item_name,
      item_type: o.item_type ?? item.item_type,
      price_list: o.list_price,
      parent_id: child?.id ?? item.id,
      is_send_pos: true,
    })
  }
  return lines
}

export function pickText(
  tr: FtTranslations | undefined,
  locale: string,
  fallbackName: string,
  fallbackDesc?: string | null
) {
  const t = tr?.[locale as FtLocale]
  return {
    name: t?.name?.trim() || fallbackName,
    description: t?.description?.trim() || fallbackDesc || '',
  }
}

const vnd = new Intl.NumberFormat('vi-VN')

export function formatVnd(amount: number) {
  return `${vnd.format(Math.round(amount))}₫`
}

/** 越南手機：0 開頭 10 碼 */
export function normalizeVnPhone(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (/^84\d{9}$/.test(digits)) return `0${digits.slice(2)}`
  return digits
}

export function isValidVnPhone(phone: string) {
  return /^0[35789]\d{8}$/.test(phone)
}
