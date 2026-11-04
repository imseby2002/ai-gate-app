import { cn } from '@/lib/utils/cn'

// im-tourist 品牌 LOGO（圓形 IM 標誌）
export function BrandLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/im-tourist-icon-512.png" alt="IM Tourist" className={cn('shrink-0 object-contain', className)} />
  )
}

// 品牌 slogan（兩行文字，文案由呼叫端依語系傳入）
export function BrandSlogan({ line1, line2, className }: { line1: string; line2: string; className?: string }) {
  return (
    <span className={cn('flex flex-col leading-tight font-bold uppercase tracking-wide text-left', className)}>
      <span className="text-[#111827]">{line1}</span>
      <span className="text-[#139488]">{line2}</span>
    </span>
  )
}
