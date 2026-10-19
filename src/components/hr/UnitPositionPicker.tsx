'use client'

// 應徵單位（門市／辦公室／工廠）→ 職位 兩層下拉
import { useTranslations, useLocale } from 'next-intl'
import { HAS_OTHER, POSITIONS, labelOf, unitKindOf, type UnitOption } from '@/lib/hr/apply-units'

export default function UnitPositionPicker({ units, store, position, onChange, disabled, className = '' }: {
  units: UnitOption[]
  store: string
  position: string
  onChange: (store: string, position: string) => void
  disabled?: boolean
  className?: string
}) {
  const t = useTranslations('Apply')
  const locale = useLocale()
  const kind = unitKindOf(units, store)
  const list = kind ? POSITIONS[kind] : []
  const known = list.some(p => p.value === position)
  const isOther = !!kind && HAS_OTHER[kind] && !!position && !known
  const sel = known ? position : isOther ? '__other' : ''
  const groups: [UnitOption['kind'], string][] = [['store', t('unitStores')], ['office', t('unitOffice')], ['factory', t('unitFactory')]]
  const legacy = store && !kind // 舊資料：不在清單內的門市名稱
  const cls = `w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-[15px] outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400 ${className}`

  return (
    <>
      <label className="block">
        <span className="block text-[13px] text-slate-600 mb-1">{t('unit')}</span>
        <select className={cls} disabled={disabled} value={store}
          onChange={e => {
            const next = e.target.value
            const nk = unitKindOf(units, next)
            onChange(next, nk && POSITIONS[nk].some(p => p.value === position) ? position : '')
          }}>
          <option value="">{t('selectPlaceholder')}</option>
          {legacy && <option value={store}>{store}</option>}
          {groups.map(([k, label]) => {
            const opts = units.filter(u => u.kind === k)
            if (!opts.length) return null
            return k === 'office'
              ? opts.map(u => <option key={u.value} value={u.value}>{label}</option>)
              : <optgroup key={k} label={label}>{opts.map(u => <option key={u.value} value={u.value}>{u.name}</option>)}</optgroup>
          })}
        </select>
      </label>
      <label className="block">
        <span className="block text-[13px] text-slate-600 mb-1">{t('position')}</span>
        <select className={cls} disabled={disabled || !kind} value={sel}
          onChange={e => onChange(store, e.target.value === '__other' ? ' ' : e.target.value)}>
          <option value="">{kind ? t('selectPlaceholder') : t('selectUnitFirst')}</option>
          {!kind && position && <option value="" disabled>{position}</option>}
          {list.map(p => <option key={p.value} value={p.value}>{labelOf(p.label, locale)}</option>)}
          {kind && HAS_OTHER[kind] && <option value="__other">{t('positionOther')}</option>}
        </select>
        {isOther && (
          <input className={`${cls} mt-2`} disabled={disabled} value={position.trim()} placeholder={t('positionOtherPlaceholder')}
            onChange={e => onChange(store, e.target.value || ' ')} />
        )}
      </label>
    </>
  )
}
