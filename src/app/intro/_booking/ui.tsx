import Link from 'next/link'
import { BedDouble, ArrowRight } from 'lucide-react'

export const BK_GRAD = 'linear-gradient(100deg,#f59e0b,#ef4444 50%,#6366f1)'
export const BALANCE = { textWrap: 'balance' } as React.CSSProperties

export function BkGradText({ children }: { children: React.ReactNode }) {
  return <span style={{ background: BK_GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{children}</span>
}

export function BkNav() {
  return (
    <nav className="flex items-center gap-3 pt-6 pb-10 flex-wrap">
      <Link href="/intro" className="flex items-center gap-3">
        <span className="grid place-items-center w-8 h-8 rounded-lg text-white shrink-0" style={{ background: BK_GRAD }}>
          <BedDouble className="h-4 w-4" />
        </span>
        <b className="font-black tracking-wide">IMT 智能訂房系統</b>
      </Link>
      <div className="ml-auto flex items-center gap-4 text-[13px] text-[#b9ab9c]">
        <Link href="/intro/features" className="hover:text-white">完整功能</Link>
        <Link href="/intro/pricing" className="hover:text-white">方案比較</Link>
        <Link href="/login" className="hover:text-white">登入</Link>
      </div>
    </nav>
  )
}

export function BkPrimaryCta({ children = '免費開始' }: { children?: React.ReactNode }) {
  return (
    <Link href="/register" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-white transition-transform hover:-translate-y-0.5"
      style={{ background: BK_GRAD, boxShadow: '0 10px 26px rgba(239,68,68,.30)' }}>
      {children} <ArrowRight className="h-4 w-4" />
    </Link>
  )
}

export function BkGhostCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-[#f7f1ea] border border-[#3a2f27] bg-white/5 transition-transform hover:-translate-y-0.5">
      {children}
    </Link>
  )
}

export function BkGlow({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 h-[70%] ${className}`}
      style={{ background: 'radial-gradient(60% 100% at 25% 0,rgba(245,158,11,.34),transparent 70%),radial-gradient(50% 100% at 85% 10%,rgba(99,102,241,.32),transparent 70%)' }} />
  )
}

export function BkDarkHeader({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <header className="relative overflow-hidden bg-[#17120f] text-[#f7f1ea]">
      <BkGlow className="-top-1/3" />
      <div className="relative max-w-5xl mx-auto px-6">
        <BkNav />
        <div className="pb-12">
          <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#fcc97a]">{eyebrow}</div>
          <h1 className="mt-3 font-black leading-[1.08] tracking-tight text-[clamp(30px,6vw,52px)]" style={BALANCE}>{title}</h1>
          {sub && <p className="mt-4 text-[#b9ab9c] text-[clamp(15px,2.2vw,18px)] max-w-[54ch]">{sub}</p>}
        </div>
      </div>
    </header>
  )
}

export function BkFinalCta({ title, sub }: { title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-[#17120f] text-[#f7f1ea]">
      <BkGlow className="-top-1/3" />
      <div className="relative max-w-5xl mx-auto px-6 py-16 text-center">
        <h2 className="mb-3 text-[clamp(26px,5vw,42px)] font-black tracking-tight" style={BALANCE}>{title}</h2>
        {sub && <p className="mb-7 text-[#b9ab9c] text-[15px]">{sub}</p>}
        <div className="flex flex-wrap gap-3 justify-center">
          <BkPrimaryCta />
          <BkGhostCta href="/login">我已有帳號</BkGhostCta>
        </div>
      </div>
    </section>
  )
}

export function BkFooter() {
  return (
    <footer className="text-center text-[#8a7d70] text-[12px] py-7 flex items-center justify-center gap-3 flex-wrap border-t border-[#e7e1d9]">
      <span className="flex items-center gap-2"><BedDouble className="h-3.5 w-3.5" /> IMT 智能訂房系統 · booking.im-tourist.com</span>
      <Link href="/intro/features" className="hover:text-[#4a4038]">完整功能</Link>
      <Link href="/intro/pricing" className="hover:text-[#4a4038]">方案比較</Link>
      <Link href="/privacy" className="hover:text-[#4a4038]">隱私權政策</Link>
    </footer>
  )
}
