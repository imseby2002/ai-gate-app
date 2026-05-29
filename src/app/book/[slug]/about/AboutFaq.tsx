'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function AboutFaq({ items, accent }: { items: { q: string; a: string }[]; accent: string }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border rounded-xl overflow-hidden">
          <button onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-gray-50 transition-colors">
            <span className="font-medium text-gray-900 text-sm">{item.q}</span>
            {open === i
              ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
              : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
          </button>
          {open === i && (
            <div className="px-4 pb-4 pt-2 text-sm text-gray-600 leading-relaxed border-t whitespace-pre-wrap">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
