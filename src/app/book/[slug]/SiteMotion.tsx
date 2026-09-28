'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// 捲動進場動畫：不引入動畫套件，用 IntersectionObserver 幫 [data-reveal] 元素加上 is-visible，
// 實際效果由 layout 裡的 CSS 依 data-anim（fade / rise / zoom / slide）決定。
// 只有這個元件跑起來後才加上 motion-ready，沒有 JS 或使用者開了「減少動態效果」時內容一律直接顯示。
export default function SiteMotion({ animation }: { animation: string }) {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.bnb-site')
    if (!root || animation === 'none') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (typeof IntersectionObserver === 'undefined') return

    root.classList.add('motion-ready')
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target) }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    const observeAll = () => root.querySelectorAll('[data-reveal]:not(.is-visible)').forEach(el => io.observe(el))
    observeAll()
    // 之後才渲染出來的區塊（換頁、非同步載入）也要接上，否則會一直停在隱藏狀態
    const mo = new MutationObserver(observeAll)
    mo.observe(root, { childList: true, subtree: true })
    return () => { io.disconnect(); mo.disconnect() }
  }, [animation, pathname])

  return null
}
