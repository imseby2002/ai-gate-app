'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react'

interface Membership {
  owner_id: string
  role: string
  owner: { email: string | null; full_name: string | null } | null
}
interface Option {
  ownerId: string
  label: string
  isSelf: boolean
  role: string
}

function readCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}

export default function BnbSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const t = useTranslations('Booking')
  const ROLE_LABEL: Record<string, string> = {
    owner: t('role.owner'), admin: t('role.admin'), manager: t('role.manager'), viewer: t('role.viewer'),
  }
  const [options, setOptions] = useState<Option[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/booking/members')
        if (!res.ok) return
        const data = await res.json()
        const self = data.self as { id: string; email: string | null }
        const memberships = (data.memberships ?? []) as Membership[]
        const opts: Option[] = [
          { ownerId: self.id, label: t('switcher.myBnb'), isSelf: true, role: 'owner' },
          ...memberships.map(m => ({
            ownerId: m.owner_id,
            label: m.owner?.full_name || m.owner?.email || t('switcher.collabBnb'),
            isSelf: false,
            role: m.role,
          })),
        ]
        if (!alive) return
        setOptions(opts)
        const cookieVal = readCookie('active_bnb_owner')
        setActiveId(cookieVal && opts.some(o => o.ownerId === cookieVal) ? cookieVal : self.id)
      } catch { /* 靜默：取不到就不顯示切換器 */ }
    })()
    return () => { alive = false }
  }, [])

  // 點外面關閉
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // 只有自己一間民宿、無任何協作 → 不顯示，維持單一民宿用戶原樣
  if (options.length <= 1) return null

  const active = options.find(o => o.ownerId === activeId) ?? options[0]

  const select = async (ownerId: string) => {
    setOpen(false)
    if (ownerId === activeId) return
    setSwitching(true)
    try {
      const res = await fetch('/api/booking/active-bnb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId }),
      })
      if (res.ok) {
        window.location.reload()
        return
      }
    } catch { /* ignore */ }
    setSwitching(false)
  }

  return (
    <div ref={ref} className={`relative ${collapsed ? 'px-1.5' : 'px-2'} mb-1`}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={switching}
        title={active.label}
        className={`w-full flex items-center rounded-lg border bg-card hover:bg-accent transition-colors
          ${collapsed ? 'justify-center p-2' : 'gap-2 px-2.5 py-2'}`}
      >
        {switching
          ? <Loader2 className="h-4 w-4 animate-spin shrink-0 text-muted-foreground" />
          : <Building2 className="h-4 w-4 shrink-0 text-primary" />}
        {!collapsed && (
          <>
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-sm font-medium truncate">{active.label}</span>
              {!active.isSelf && <span className="block text-[10px] text-muted-foreground">{ROLE_LABEL[active.role] ?? active.role}</span>}
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {open && (
        <div className={`absolute z-50 mt-1 rounded-lg border bg-popover shadow-lg overflow-hidden
          ${collapsed ? 'left-1.5 right-auto w-48' : 'left-2 right-2'}`}>
          {options.map(o => (
            <button key={o.ownerId} onClick={() => select(o.ownerId)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm truncate">{o.label}</span>
                {!o.isSelf && <span className="block text-[10px] text-muted-foreground">{ROLE_LABEL[o.role] ?? o.role}</span>}
              </span>
              {o.ownerId === activeId && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
