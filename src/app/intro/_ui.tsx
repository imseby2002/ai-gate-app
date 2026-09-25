import Link from 'next/link'
import { Zap, ArrowRight } from 'lucide-react'

export const GRAD = 'linear-gradient(100deg,#7b5cf0,#a34be0 42%,#e0479b)'
export const BALANCE = { textWrap: 'balance' } as React.CSSProperties

export function GradText({ children }: { children: React.ReactNode }) {
  return <span style={{ background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{children}</span>
}

export function IntroNav() {
  return (
    <nav className="flex items-center gap-3 pt-6 pb-10 flex-wrap">
      <Link href="/intro" className="flex items-center gap-3">
        <span className="grid place-items-center w-8 h-8 rounded-lg text-white font-black shrink-0" style={{ background: GRAD }}>⚡</span>
        <b className="font-black tracking-wide">AI GATE 行銷中心</b>
      </Link>
      <div className="ml-auto flex items-center gap-4 text-[13px] text-[#b3aac6]">
        <Link href="/intro/features" className="hover:text-white">功能詳解</Link>
        <Link href="/intro/pricing" className="hover:text-white">方案比較</Link>
        <Link href="/login" className="hover:text-white">登入</Link>
      </div>
    </nav>
  )
}

export function PrimaryCta({ children = '免費開始' }: { children?: React.ReactNode }) {
  return (
    <Link href="/register" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-white transition-transform hover:-translate-y-0.5"
      style={{ background: GRAD, boxShadow: '0 10px 26px rgba(123,92,240,.4)' }}>
      {children} <ArrowRight className="h-4 w-4" />
    </Link>
  )
}

export function GhostCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-[#f4f0fb] border border-[#2c2440] bg-white/5 transition-transform hover:-translate-y-0.5">
      {children}
    </Link>
  )
}

export function DarkHeader({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <header className="relative overflow-hidden bg-[#161020] text-[#f4f0fb]">
      <div className="pointer-events-none absolute -top-1/3 inset-x-0 h-[70%]"
        style={{ background: 'radial-gradient(60% 100% at 30% 0,rgba(123,92,240,.42),transparent 70%),radial-gradient(50% 100% at 85% 10%,rgba(224,71,155,.30),transparent 70%)' }} />
      <div className="relative max-w-5xl mx-auto px-6">
        <IntroNav />
        <div className="pb-12">
          <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#c9b7ff]">{eyebrow}</div>
          <h1 className="mt-3 font-black leading-[1.08] tracking-tight text-[clamp(30px,6vw,52px)]" style={BALANCE}>{title}</h1>
          {sub && <p className="mt-4 text-[#b3aac6] text-[clamp(15px,2.2vw,18px)] max-w-[52ch]">{sub}</p>}
        </div>
      </div>
    </header>
  )
}

export function FinalCta({ title }: { title: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-[#161020] text-[#f4f0fb]">
      <div className="pointer-events-none absolute -top-1/3 inset-x-0 h-[70%]"
        style={{ background: 'radial-gradient(60% 100% at 50% 0,rgba(123,92,240,.34),transparent 70%)' }} />
      <div className="relative max-w-5xl mx-auto px-6 py-16 text-center">
        <h2 className="mb-6 text-[clamp(26px,5vw,42px)] font-black tracking-tight" style={BALANCE}>{title}</h2>
        <div className="flex flex-wrap gap-3 justify-center">
          <PrimaryCta />
          <GhostCta href="/login">我已有帳號</GhostCta>
        </div>
      </div>
    </section>
  )
}

export function IntroFooter() {
  return (
    <footer className="text-center text-[#938da3] text-[12px] py-7 flex items-center justify-center gap-3 flex-wrap">
      <span className="flex items-center gap-2"><Zap className="h-3.5 w-3.5" /> AI GATE 行銷中心 · IMT</span>
      <Link href="/intro/features" className="hover:text-[#615c70]">功能詳解</Link>
      <Link href="/intro/pricing" className="hover:text-[#615c70]">方案比較</Link>
      <Link href="/privacy" className="hover:text-[#615c70]">隱私權政策</Link>
    </footer>
  )
}
