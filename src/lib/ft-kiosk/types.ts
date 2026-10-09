// 會員 APP（FeelingTea）後端 `/app/api/v1/item_categories` 回傳的資料結構。
// 欄位名稱照舊系統 Items / ItemCategory model，詳見 docs/kiosk-ipos-order-flow.md。

export type FtLocale = 'zh-TW' | 'en' | 'vi'

/** 自建翻譯表：iPOS 只有一種語言（越南文） */
export type FtTranslations = Partial<Record<FtLocale, { name?: string; description?: string }>>

export interface FtOption {
  id: string
  item_no: string
  item_name: string
  item_type?: string | null
  list_price: number
  /** 舊系統同步時 bool 會被原始字串 ACTIVE / DEACTIVE 覆蓋，兩種都要處理 */
  status?: boolean | string | null
  sort?: number | null
  translations?: FtTranslations
}

export interface FtCustomization {
  id: string
  name: string
  min_permitted: number | null
  max_permitted: number | null
  options: FtOption[]
  translations?: FtTranslations
}

/** size（childs），本身就是一個可送 POS 的品項 */
export interface FtChild {
  id: string
  item_no: string
  item_name: string
  item_type?: string | null
  list_price: number
  active?: boolean | null
  sort?: number | null
  customizations?: FtCustomization[]
  translations?: FtTranslations
}

export interface FtItem {
  id: string
  item_no: string
  item_name: string
  item_type: string
  description?: string | null
  list_price: number
  thumbnail?: string | null
  sort?: number | null
  childs?: FtChild[] | null
  customizations?: FtCustomization[] | null
  translations?: FtTranslations
}

export interface FtCategory {
  id: string
  category_no: string
  category_name: string
  sort?: number | null
  thumbnail?: string | null
  items: FtItem[]
  translations?: FtTranslations
}

export interface FtMenu {
  storeName: string
  categories: FtCategory[]
  mock: boolean
}

/** 客人在點單機上選的一杯；只送 id，價格由伺服器依菜單重算 */
export interface FtSelection {
  itemId: string
  childId?: string | null
  optionIds: string[]
  qty: number
  note?: string
}

/** 送會員 APP `/api/v1.0/order/check` 的 items 每一行 */
export interface FtOrderLine {
  id: string
  item_no: string
  item_name: string
  item_type: string
  quantity: number
  price_list: number
  parent_id: string
  note?: string
  time_choose: number
  thumbnail: string
  is_send_pos: boolean
}

export type FtDineOption = 'dine_in' | 'takeaway'

export interface FtOrderRequest {
  selections: FtSelection[]
  phone?: string | null
  dineOption: FtDineOption
}

export interface FtOrderResult {
  orderNo: string
  amount: number
  mock: boolean
}

export type FtMemberStatus = 'member' | 'not_member'
