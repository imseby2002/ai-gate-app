'use client'

import { Delete } from 'lucide-react'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const

/** 觸控數字鍵盤，避免叫出系統鍵盤 */
export function FtPhoneKeypad({
  value,
  onChange,
  clearLabel,
  maxLength = 10,
}: {
  value: string
  onChange: (v: string) => void
  clearLabel: string
  maxLength?: number
}) {
  function press(k: (typeof KEYS)[number]) {
    if (k === 'clear') onChange('')
    else if (k === 'back') onChange(value.slice(0, -1))
    else if (value.length < maxLength) onChange(value + k)
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {KEYS.map(k => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className="flex h-20 items-center justify-center rounded-2xl bg-stone-100 text-3xl font-semibold transition active:scale-95 active:bg-stone-200"
        >
          {k === 'back' ? <Delete className="h-8 w-8" aria-label="backspace" /> : k === 'clear' ? <span className="text-lg">{clearLabel}</span> : k}
        </button>
      ))}
    </div>
  )
}
