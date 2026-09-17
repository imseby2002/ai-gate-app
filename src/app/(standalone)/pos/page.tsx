'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Store, UtensilsCrossed, ClipboardList, Monitor, ShoppingBag } from 'lucide-react'
import { Card } from '@/components/ui/card'

const LINK_KEYS = [
  { href: '/pos/stores', icon: Store, key: 'stores' },
  { href: '/pos/menu', icon: UtensilsCrossed, key: 'menu' },
  { href: '/pos/orders', icon: ClipboardList, key: 'orders' },
  { href: '/pos/kiosk', icon: Monitor, key: 'kiosk' },
]

export default function PosHubPage() {
  const t = useTranslations('PosHub')
  const LINKS = LINK_KEYS.map(l => ({ ...l, title: t(`${l.key}_title`), desc: t(`${l.key}_desc`) }))
  return (
    <div className="mx-auto max-w-3xl px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><ShoppingBag className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
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
