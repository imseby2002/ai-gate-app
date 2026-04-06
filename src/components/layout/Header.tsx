'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { User, LogOut, Settings, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { LanguageSwitcher } from './LanguageSwitcher'
import type { Profile } from '@/types/database'

interface HeaderProps {
  profile: Profile
  creditBalance?: number
  locale: string
}

export function Header({ profile, creditBalance, locale }: HeaderProps) {
  const router = useRouter()
  const t = useTranslations('Header')
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const userTypeBadge = {
    employee: { label: t('userTypeEmployee'), variant: 'secondary' as const },
    external: { label: t('userTypeExternal'), variant: 'outline' as const },
    admin:    { label: t('userTypeAdmin'),    variant: 'default' as const },
  }[profile.user_type]

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b bg-background">
      <div />
      <div className="flex items-center gap-3">
        {profile.user_type === 'external' && creditBalance !== undefined && (
          <div className="flex items-center gap-1.5 text-sm">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">${creditBalance?.toFixed(2)}</span>
            <span className="text-muted-foreground">{t('balance')}</span>
          </div>
        )}

        <LanguageSwitcher currentLocale={locale} />

        <Badge variant={userTypeBadge.variant}>{userTypeBadge.label}</Badge>

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium">{profile.full_name ?? profile.email}</span>
          </Button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border bg-popover shadow-md z-50">
              <div className="p-2 space-y-1">
                <p className="px-3 py-1 text-xs text-muted-foreground truncate">{profile.email}</p>
                <hr />
                <button
                  onClick={() => { router.push('/settings'); setMenuOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent"
                >
                  <Settings className="h-4 w-4" /> {t('settings')}
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent text-destructive"
                >
                  <LogOut className="h-4 w-4" /> {t('signOut')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
