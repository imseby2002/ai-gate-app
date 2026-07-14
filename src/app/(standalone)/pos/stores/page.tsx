'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface StoreRow {
  id: string
  name: string
  slug: string
  pos_terminals: { id: string; name: string; device_key: string; last_sync_at: string | null }[]
}

export default function PosStoresPage() {
  const [stores, setStores] = useState<StoreRow[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/pos/stores')
    const d = await res.json()
    setStores(d.stores ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function create() {
    if (!name.trim()) return
    await fetch('/api/pos/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setName('')
    load()
  }

  if (loading) return <p className="p-6 text-muted-foreground">載入中…</p>

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <h1 className="text-2xl font-bold">門市與終端</h1>
      <p className="text-sm text-muted-foreground">每間門市一台 Debian 終端。將 device_key 填入 Kiosk 或 pos-bridge。</p>

      <Card className="flex gap-2 p-3">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="門市名稱" />
        <Button onClick={create} disabled={!name.trim()}>新增門市</Button>
      </Card>

      <div className="space-y-3">
        {stores.map(s => {
          const term = s.pos_terminals?.[0]
          return (
            <Card key={s.id} className="space-y-2 p-4">
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-muted-foreground">slug: {s.slug}</p>
              {term ? (
                <>
                  <p className="text-xs">終端：{term.name}</p>
                  <p className="break-all rounded bg-muted p-2 font-mono text-xs">{term.device_key}</p>
                  <p className="text-xs text-muted-foreground">
                    上次同步：{term.last_sync_at ? new Date(term.last_sync_at).toLocaleString() : '尚未'}
                  </p>
                  <p className="text-xs">
                    Kiosk：<code className="rounded bg-muted px-1">/pos/kiosk?key={term.device_key.slice(0, 8)}…</code>
                  </p>
                </>
              ) : (
                <p className="text-xs text-amber-600">尚無終端</p>
              )}
            </Card>
          )
        })}
        {stores.length === 0 && <p className="text-sm text-muted-foreground">尚無門市</p>}
      </div>
    </div>
  )
}
