import Link from 'next/link'
import { Headphones, ArrowRight } from 'lucide-react'

export const CS_GRAD = 'linear-gradient(100deg,#14b8a6,#2563eb 55%,#7c3aed)'
export const BALANCE = { textWrap: 'balance' } as React.CSSProperties

export function CsGradText({ children }: { children: React.ReactNode }) {
  return <span style={{ background: CS_GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{children}</span>
}

export function CsNav() {
  return (
    <nav className="flex items-center gap-3 pt-6 pb-10 flex-wrap">
      <Link href="/intro" className="flex items-center gap-3">
        <span className="grid place-items-center w-8 h-8 rounded-lg text-white shrink-0" style={{ background: CS_GRAD }}>
          <Headphones className="h-4 w-4" />
        </span>
        <b className="font-black tracking-wide">IMT 智能客服</b>
      </Link>
      <div className="ml-auto flex items-center gap-4 text-[13px] text-[#9fb3bf]">
        <Link href="/intro/features" className="hover:text-white">完整功能</Link>
        <Link href="/intro/pricing" className="hover:text-white">方案價格</Link>
        <Link href="/login" className="hover:text-white">登入</Link>
      </div>
    </nav>
  )
}

export function CsPrimaryCta({ children = '免費開始' }: { children?: React.ReactNode }) {
  return (
    <Link href="/register" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-white transition-transform hover:-translate-y-0.5"
      style={{ background: CS_GRAD, boxShadow: '0 10px 28px rgba(37,99,235,.38)' }}>
      {children} <ArrowRight className="h-4 w-4" />
    </Link>
  )
}

export function CsGhostCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-[#eef5f8] border border-[#1f3140] bg-white/5 transition-transform hover:-translate-y-0.5">
      {children}
    </Link>
  )
}

export function CsGlow({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 h-[70%] ${className}`}
      style={{ background: 'radial-gradient(60% 100% at 25% 0,rgba(20,184,166,.36),transparent 70%),radial-gradient(50% 100% at 85% 10%,rgba(37,99,235,.30),transparent 70%)' }} />
  )
}

export function CsDarkHeader({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <header className="relative overflow-hidden bg-[#0b1620] text-[#eef5f8]">
      <CsGlow className="-top-1/3" />
      <div className="relative max-w-5xl mx-auto px-6">
        <CsNav />
        <div className="pb-12">
          <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#7fe0db]">{eyebrow}</div>
          <h1 className="mt-3 font-black leading-[1.08] tracking-tight text-[clamp(30px,6vw,52px)]" style={BALANCE}>{title}</h1>
          {sub && <p className="mt-4 text-[#9fb3bf] text-[clamp(15px,2.2vw,18px)] max-w-[54ch]">{sub}</p>}
        </div>
      </div>
    </header>
  )
}

export function CsFinalCta({ title, sub }: { title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-[#0b1620] text-[#eef5f8]">
      <CsGlow className="-top-1/3" />
      <div className="relative max-w-5xl mx-auto px-6 py-16 text-center">
        <h2 className="mb-3 text-[clamp(26px,5vw,42px)] font-black tracking-tight" style={BALANCE}>{title}</h2>
        {sub && <p className="mb-7 text-[#9fb3bf] text-[15px]">{sub}</p>}
        <div className="flex flex-wrap gap-3 justify-center">
          <CsPrimaryCta />
          <CsGhostCta href="/login">我已有帳號</CsGhostCta>
        </div>
      </div>
    </section>
  )
}

export function CsFooter() {
  return (
    <footer className="text-center text-[#7b8a94] text-[12px] py-7 flex items-center justify-center gap-3 flex-wrap border-t border-[#dde5ea]">
      <span className="flex items-center gap-2"><Headphones className="h-3.5 w-3.5" /> IMT 智能客服 · cs.im-tourist.com</span>
      <Link href="/intro/features" className="hover:text-[#3d4a52]">完整功能</Link>
      <Link href="/intro/pricing" className="hover:text-[#3d4a52]">方案價格</Link>
      <Link href="/privacy" className="hover:text-[#3d4a52]">隱私權政策</Link>
    </footer>
  )
}

export function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <>
      <div className="font-mono text-[12px] tracking-[0.16em] uppercase text-[#0d8f8e] mb-2">{eyebrow}</div>
      <h2 className="text-[clamp(24px,4vw,34px)] font-black tracking-tight mb-1" style={BALANCE}>{title}</h2>
      {sub && <p className="text-[#56646d] text-[15px] max-w-[58ch] mb-7">{sub}</p>}
    </>
  )
}
