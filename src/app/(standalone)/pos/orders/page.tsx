'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { ClipboardList } from 'lucide-react'
import type { PosCartLine, PosOrderStatus } from '@/lib/pos/types'

interface OrderRow {
  id: string
  order_no: string
  order_type: string
  table_label: string | null
  status: PosOrderStatus
  items: PosCartLine[]
  total_cents: number
  note: string
  created_at: string
  pos_stores: { name: string }
}

const STATUS: { id: PosOrderStatus; label: string }[] = [
  { id: 'pending', label: '待處理' },
  { id: 'preparing', label: '製作中' },
  { id: 'ready', label: '可取餐' },
  { id: 'done', label: '完成' },
  { id: 'cancelled', label: '取消' },
]

const TYPE_LABEL: Record<string, string> = { dine_in: '內用', takeout: '外帶', delivery: '外送' }

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(0)}`
}

export default function PosOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [filter, setFilter] = useState<string>('')

  const load = useCallback(async () => {
    const q = filter ? `?status=${filter}` : ''
    const res = await fetch(`/api/pos/orders${q}`)
    const d = await res.json()
    setOrders(d.orders ?? [])
  }, [filter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const sb = createClient()
    const ch = sb
      .channel('pos_orders_cloud')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_orders' }, () => load())
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [load])

  async function setStatus(id: string, status: PosOrderStatus) {
    await fetch(`/api/pos/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><ClipboardList className="h-5 w-5 text-primary" /></div>
        <h1 className="text-2xl font-bold">訂單管理</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={!filter ? 'default' : 'outline'} onClick={() => setFilter('')}>全部</Button>
        {STATUS.map(s => (
          <Button key={s.id} size="sm" variant={filter === s.id ? 'default' : 'outline'} onClick={() => setFilter(s.id)}>
            {s.label}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {orders.map(o => (
          <Card key={o.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold">{o.order_no}</span>
              <Badge>{TYPE_LABEL[o.order_type] ?? o.order_type}</Badge>
              {o.table_label && <Badge variant="outline">桌 {o.table_label}</Badge>}
              <Badge variant="secondary">{STATUS.find(s => s.id === o.status)?.label}</Badge>
              <span className="ml-auto text-sm text-muted-foreground">{o.pos_stores?.name}</span>
            </div>
            <ul className="text-sm">
              {o.items.map((line, i) => (
                <li key={i}>
                  {line.name} ×{line.qty} {fmt(line.lineTotalCents)}
                  {line.modifiers?.length > 0 && (
                    <span className="text-muted-foreground">（{line.modifiers.map(m => m.optionLabel).join('、')}）</span>
                  )}
                </li>
              ))}
            </ul>
            {o.note && <p className="text-xs text-muted-foreground">備註：{o.note}</p>}
            <div className="flex items-center justify-between border-t pt-2">
              <span className="font-semibold">{fmt(o.total_cents)}</span>
              <div className="flex gap-1">
                {STATUS.filter(s => s.id !== o.status && s.id !== 'cancelled').map(s => (
                  <Button key={s.id} size="sm" variant="outline" onClick={() => setStatus(o.id, s.id)}>{s.label}</Button>
                ))}
              </div>
            </div>
          </Card>
        ))}
        {orders.length === 0 && <p className="text-sm text-muted-foreground">尚無訂單</p>}
      </div>
    </div>
  )
}
