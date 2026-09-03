'use client'

import Link from 'next/link'
import { Store, UtensilsCrossed, ClipboardList, Monitor, ShoppingBag } from 'lucide-react'
import { Card } from '@/components/ui/card'

const LINKS = [
  { href: '/pos/stores', icon: Store, title: '門市與終端', desc: '一店一終端、裝置金鑰' },
  { href: '/pos/menu', icon: UtensilsCrossed, title: '菜單編輯', desc: '全域或門市專屬菜單，多店同步' },
  { href: '/pos/orders', icon: ClipboardList, title: '訂單管理', desc: '雲端查看與修改訂單' },
  { href: '/pos/kiosk', icon: Monitor, title: '點單 Kiosk', desc: '門市客戶點單（可離線）' },
]

export default function PosHubPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><ShoppingBag className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">門市點單</h1>
          <p className="text-sm text-muted-foreground">雲端編輯菜單、多店同步；Debian 終端離線點單後上傳。</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {LINKS.map(l => (
          <Link key={l.href} href={l.href}>
            <Card className="flex gap-3 p-4 transition-colors hover:bg-muted/50">
              <l.icon className="h-8 w-8 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">{l.title}</p>
                <p className="text-xs text-muted-foreground">{l.desc}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
