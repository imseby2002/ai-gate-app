'use client'

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

/** 依內容自動長高的文字框（不出現內部捲軸） */
export function AutoTextarea({ minRows = 2, className = '', value, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return (
    <textarea ref={ref} rows={minRows} value={value} {...rest}
      className={`w-full resize-y overflow-hidden rounded-md border bg-background p-2.5 text-sm leading-relaxed disabled:opacity-70 ${className}`} />
  )
}
