'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  activeChilds,
  customizationsFor,
  formatVnd,
  groupMax,
  groupMin,
  pickText,
} from '@/lib/ft-kiosk/cart'
import type { FtCustomization, FtItem, FtSelection } from '@/lib/ft-kiosk/types'

function defaultPicks(groups: FtCustomization[]) {
  const init: Record<string, string[]> = {}
  for (const g of groups) {
    const min = groupMin(g)
    if (min > 0) init[g.id] = g.options.slice(0, min).map(o => o.id)
  }
  return init
}

export function FtItemDialog({
  item,
  onClose,
  onAdd,
}: {
  item: FtItem
  onClose: () => void
  onAdd: (sel: FtSelection) => void
}) {
  const t = useTranslations('FtKiosk')
  const locale = useLocale()
  const childs = useMemo(() => activeChilds(item), [item])
  const [childId, setChildId] = useState<string | null>(childs[0]?.id ?? null)
  const child = childs.find(c => c.id === childId) ?? null
  const groups = useMemo(() => customizationsFor(item, child), [item, child])
  const [picks, setPicks] = useState<Record<string, string[]>>(() => defaultPicks(groups))
  const [qty, setQty] = useState(1)

  const text = pickText(item.translations, locale, item.item_name, item.description)

  function chooseChild(id: string) {
    setChildId(id)
    const next = childs.find(c => c.id === id) ?? null
    const nextGroups = customizationsFor(item, next)
    // 保留新 size 仍存在的選項，其餘補預設
    setPicks(prev => {
      const out = defaultPicks(nextGroups)
      for (const g of nextGroups) {
        const kept = (prev[g.id] ?? []).filter(oid => g.options.some(o => o.id === oid))
        if (kept.length >= groupMin(g)) out[g.id] = kept
      }
      return out
    })
  }

  function toggle(g: FtCustomization, optionId: string) {
    setPicks(prev => {
      const cur = prev[g.id] ?? []
      const max = groupMax(g)
      if (max === 1) return { ...prev, [g.id]: [optionId] }
      if (cur.includes(optionId)) {
        if (cur.length <= groupMin(g)) return prev
        return { ...prev, [g.id]: cur.filter(x => x !== optionId) }
      }
      if (cur.length >= max) return prev
      return { ...prev, [g.id]: [...cur, optionId] }
    })
  }

  const valid = groups.every(g => {
    const n = (picks[g.id] ?? []).length
    return n >= groupMin(g) && n <= groupMax(g)
  })
  const optionIds = groups.flatMap(g => picks[g.id] ?? [])
  const unit =
    (child ? child.list_price : item.list_price) +
    groups.flatMap(g => g.options).filter(o => optionIds.includes(o.id)).reduce((s, o) => s + o.list_price, 0)

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="relative shrink-0">
          {item.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumbnail} alt={text.name} className="h-56 w-full object-cover" />
          ) : (
            <div className="flex h-40 items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-500 text-6xl font-bold text-white">
              {text.name.charAt(0)}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cancel')}
            className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <h2 className="text-3xl font-bold">{text.name}</h2>
            {text.description && <p className="mt-2 text-lg text-stone-500">{text.description}</p>}
          </div>

          {childs.length > 0 && (
            <section>
              <p className="mb-3 text-lg font-semibold">
                {t('size')} <span className="text-sm font-normal text-rose-600">{t('required')}</span>
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {childs.map(c => {
                  const sel = c.id === childId
                  const ct = pickText(c.translations, locale, c.item_name)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => chooseChild(c.id)}
                      className={`rounded-2xl border-2 px-4 py-4 text-left transition ${sel ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200'}`}
                    >
                      <p className="text-lg font-semibold">{ct.name}</p>
                      <p className="text-stone-500">{formatVnd(c.list_price)}</p>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {groups.map(g => {
            const min = groupMin(g)
            const max = groupMax(g)
            const gt = pickText(g.translations, locale, g.name)
            const hint = min > 0 ? (max === min ? t('pickExactly', { n: min }) : t('required')) : t('pickUpTo', { n: max })
            return (
              <section key={g.id}>
                <p className="mb-3 text-lg font-semibold">
                  {gt.name}{' '}
                  <span className={`text-sm font-normal ${min > 0 ? 'text-rose-600' : 'text-stone-400'}`}>{hint}</span>
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {g.options.map(o => {
                    const sel = (picks[g.id] ?? []).includes(o.id)
                    const ot = pickText(o.translations, locale, o.item_name)
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => toggle(g, o.id)}
                        className={`flex items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3 text-left transition ${sel ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200'}`}
                      >
                        <span>
                          <span className="block font-medium">{ot.name}</span>
                          {o.list_price > 0 && <span className="text-sm text-stone-500">+{formatVnd(o.list_price)}</span>}
                        </span>
                        {sel && <Check className="h-5 w-5 shrink-0 text-emerald-600" />}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        <div className="flex shrink-0 items-center gap-4 border-t bg-stone-50 p-5">
          <div className="flex items-center gap-3">
            <Button size="icon" variant="outline" className="h-14 w-14 rounded-full" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="-">
              <Minus className="h-6 w-6" />
            </Button>
            <span className="w-10 text-center text-2xl font-bold">{qty}</span>
            <Button size="icon" variant="outline" className="h-14 w-14 rounded-full" onClick={() => setQty(q => Math.min(50, q + 1))} aria-label="+">
              <Plus className="h-6 w-6" />
            </Button>
          </div>
          <Button
            className="h-16 flex-1 rounded-2xl bg-emerald-700 text-xl hover:bg-emerald-800"
            disabled={!valid}
            onClick={() => onAdd({ itemId: item.id, childId, optionIds, qty })}
          >
            {t('addToCart')} · {formatVnd(unit * qty)}
          </Button>
        </div>
      </div>
    </div>
  )
}
