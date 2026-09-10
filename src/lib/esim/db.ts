import { createAdminClient } from '@/lib/supabase/admin'
import fs from 'fs'
import path from 'path'

export interface EsimOrder {
  id: string
  order_no: string
  customer_email: string
  customer_name?: string
  customer_phone?: string
  
  channel_dataplan_id: string
  channel_dataplan_name: string
  country_code: string
  country_name: string
  day: number
  data_amount: string
  quantity: number
  
  unit_price_twd: number
  total_price_twd: number
  cost_hkd: number
  currency: string
  
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
  payment_method: string
  payment_trade_no?: string
  paid_at?: string
  
  microesim_status: 'pending' | 'subscribed' | 'delivered' | 'failed'
  microesim_topup_id?: string
  iccid?: string
  qr_code_url?: string
  activation_code?: string
  apn?: string
  operator_info?: string
  error_message?: string
  
  email_sent?: boolean
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

const LOCAL_ORDERS_FILE = path.join(process.cwd(), 'scratch', 'esim_orders_fallback.json')

function readLocalOrders(): Record<string, EsimOrder> {
  try {
    if (fs.existsSync(LOCAL_ORDERS_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_ORDERS_FILE, 'utf8'))
    }
  } catch (err) {
    console.warn('[EsimDB] Failed to read fallback orders file:', err)
  }
  return {}
}

function writeLocalOrders(orders: Record<string, EsimOrder>) {
  try {
    const dir = path.dirname(LOCAL_ORDERS_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(LOCAL_ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8')
  } catch (err) {
    console.warn('[EsimDB] Failed to save fallback orders file:', err)
  }
}

/**
 * 建立新訂單
 */
export async function createEsimOrder(orderData: Omit<EsimOrder, 'id' | 'created_at' | 'updated_at'>): Promise<EsimOrder> {
  const now = new Date().toISOString()
  const order: EsimOrder = {
    ...orderData,
    id: `esim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at: now,
    updated_at: now,
  }

  // 1. 嘗試存入 Supabase
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('esim_orders')
      .insert({
        order_no: order.order_no,
        customer_email: order.customer_email,
        customer_name: order.customer_name || '',
        customer_phone: order.customer_phone || '',
        channel_dataplan_id: order.channel_dataplan_id,
        channel_dataplan_name: order.channel_dataplan_name,
        country_code: order.country_code,
        country_name: order.country_name,
        day: order.day,
        data_amount: order.data_amount,
        quantity: order.quantity,
        unit_price_twd: order.unit_price_twd,
        total_price_twd: order.total_price_twd,
        cost_hkd: order.cost_hkd,
        currency: order.currency,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        payment_trade_no: order.payment_trade_no || null,
        paid_at: order.paid_at || null,
        microesim_status: order.microesim_status,
        microesim_topup_id: order.microesim_topup_id || null,
        iccid: order.iccid || null,
        qr_code_url: order.qr_code_url || null,
        activation_code: order.activation_code || null,
        apn: order.apn || null,
        operator_info: order.operator_info || null,
        error_message: order.error_message || null,
        email_sent: order.email_sent || false,
        metadata: order.metadata || {},
      })
      .select()
      .maybeSingle()

    if (!error && data) {
      return { ...order, id: data.id }
    } else {
      console.warn('[EsimDB] Supabase insert note (using fallback):', error?.message)
    }
  } catch (err: any) {
    console.warn('[EsimDB] Supabase unavailable, fallback to local storage:', err.message)
  }

  // 2. 本地 Fallback 儲存
  const local = readLocalOrders()
  local[order.order_no] = order
  writeLocalOrders(local)
  return order
}

/**
 * 依據 order_no 查詢訂單
 */
export async function getEsimOrderByNo(orderNo: string): Promise<EsimOrder | null> {
  // 1. 查詢 Supabase
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('esim_orders')
      .select('*')
      .eq('order_no', orderNo)
      .maybeSingle()

    if (!error && data) {
      return data as EsimOrder
    }
  } catch (err) {
    // Fallback
  }

  // 2. 本地 Fallback 查詢
  const local = readLocalOrders()
  return local[orderNo] || null
}

/**
 * 更新訂單（如付款成功、MicroEsim 發卡完成等）
 */
export async function updateEsimOrder(orderNo: string, updates: Partial<EsimOrder>): Promise<EsimOrder | null> {
  const now = new Date().toISOString()
  const payload = { ...updates, updated_at: now }

  // 1. 更新 Supabase
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('esim_orders')
      .update(payload)
      .eq('order_no', orderNo)
      .select()
      .maybeSingle()

    if (!error && data) {
      return data as EsimOrder
    }
  } catch (err) {
    // Fallback
  }

  // 2. 本地 Fallback 更新
  const local = readLocalOrders()
  if (local[orderNo]) {
    local[orderNo] = { ...local[orderNo], ...payload }
    writeLocalOrders(local)
    return local[orderNo]
  }

  return null
}

/**
 * 依據顧客 Email 查詢所有訂單
 */
export async function getEsimOrdersByEmail(email: string): Promise<EsimOrder[]> {
  const cleanEmail = email.trim().toLowerCase()

  // 1. 查詢 Supabase
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('esim_orders')
      .select('*')
      .ilike('customer_email', cleanEmail)
      .order('created_at', { ascending: false })

    if (!error && data && data.length > 0) {
      return data as EsimOrder[]
    }
  } catch (err) {
    // Fallback
  }

  // 2. 本地 Fallback 查詢
  const local = readLocalOrders()
  return Object.values(local)
    .filter(o => o.customer_email.toLowerCase() === cleanEmail)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

/**
 * 取得所有訂單清單（供後台管理）
 */
export async function getAllEsimOrders(limit: number = 100): Promise<EsimOrder[]> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('esim_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!error && data) {
      return data as EsimOrder[]
    }
  } catch (err) {
    // Fallback
  }

  const local = readLocalOrders()
  return Object.values(local)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
}
