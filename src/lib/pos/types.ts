export type PosOrderType = 'dine_in' | 'takeout' | 'delivery'
export type PosOrderStatus = 'pending' | 'preparing' | 'ready' | 'done' | 'cancelled'

export interface PosModifierOption {
  id: string
  label: string
  priceDelta: number // cents
}

export interface PosModifierGroup {
  id: string
  label: string
  required: boolean
  min: number
  max: number
  options: PosModifierOption[]
}

export interface PosCartModifier {
  groupId: string
  groupLabel: string
  optionId: string
  optionLabel: string
  priceDelta: number
}

export interface PosCartLine {
  itemId: string
  name: string
  unitPriceCents: number
  qty: number
  modifiers: PosCartModifier[]
  lineTotalCents: number
  note?: string
}

export interface PosStore {
  id: string
  owner_id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
}

export interface PosTerminal {
  id: string
  store_id: string
  owner_id: string
  name: string
  device_key: string
  last_sync_at: string | null
  last_menu_revision: number
  created_at: string
}

export interface PosCategory {
  id: string
  owner_id: string
  store_id: string | null
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PosItem {
  id: string
  owner_id: string
  category_id: string
  store_id: string | null
  name: string
  description: string
  price_cents: number
  barcode: string | null
  image_url: string | null
  modifiers: PosModifierGroup[]
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PosOrder {
  id: string
  owner_id: string
  store_id: string
  terminal_id: string
  client_id: string
  order_no: string
  order_type: PosOrderType
  table_label: string | null
  status: PosOrderStatus
  items: PosCartLine[]
  note: string
  subtotal_cents: number
  total_cents: number
  menu_revision: number | null
  created_at: string
  updated_at: string
}

export const DEFAULT_MODIFIER_GROUPS: PosModifierGroup[] = [
  {
    id: 'sweetness',
    label: '甜度',
    required: true,
    min: 1,
    max: 1,
    options: [
      { id: 'full', label: '全糖', priceDelta: 0 },
      { id: '70', label: '七分糖', priceDelta: 0 },
      { id: 'half', label: '半糖', priceDelta: 0 },
      { id: '30', label: '三分糖', priceDelta: 0 },
      { id: 'none', label: '無糖', priceDelta: 0 },
    ],
  },
  {
    id: 'ice',
    label: '冰塊',
    required: true,
    min: 1,
    max: 1,
    options: [
      { id: 'normal', label: '正常冰', priceDelta: 0 },
      { id: 'less', label: '少冰', priceDelta: 0 },
      { id: 'light', label: '微冰', priceDelta: 0 },
      { id: 'no', label: '去冰', priceDelta: 0 },
      { id: 'hot', label: '熱飲', priceDelta: 0 },
    ],
  },
  {
    id: 'toppings',
    label: '加料',
    required: false,
    min: 0,
    max: 5,
    options: [
      { id: 'pearl', label: '珍珠', priceDelta: 1000 },
      { id: 'pudding', label: '布丁', priceDelta: 1000 },
      { id: 'grass', label: '仙草', priceDelta: 1000 },
      { id: 'coconut', label: '椰果', priceDelta: 1000 },
    ],
  },
]

export const POS_ORDER_TYPES: { id: PosOrderType; label: string }[] = [
  { id: 'dine_in', label: '內用' },
  { id: 'takeout', label: '外帶' },
  { id: 'delivery', label: '外送' },
]

export function calcLineTotal(unitPriceCents: number, qty: number, modifiers: PosCartModifier[]) {
  const modTotal = modifiers.reduce((s, m) => s + m.priceDelta, 0)
  return (unitPriceCents + modTotal) * qty
}

export function calcCartTotal(lines: PosCartLine[]) {
  return lines.reduce((s, l) => s + l.lineTotalCents, 0)
}
