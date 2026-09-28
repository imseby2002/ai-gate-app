'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { animate, hover, inView, scroll, stagger, type DOMKeyframesDefinition } from 'motion'
import type { SiteAnimation } from '@/lib/booking/templates'

// 公開官網動畫（Motion）：
// - [data-reveal]：捲動進場，同一個父層裡的多個元素依序錯開
// - [data-split]：大標題逐字浮現（字元由 SplitText 先切好 span，不在這裡改 DOM）
// - [data-parallax]：大圖跟著捲動做視差位移
// - [data-card]：滑鼠移上去時彈性上浮
// 沒有 JS 或使用者開了「減少動態效果」時什麼都不做，內容一律直接顯示（隱藏只在加上 motion-ready 後才生效）。

const REVEAL: Record<Exclude<SiteAnimation, 'none'>, DOMKeyframesDefinition> = {
  fade:   { opacity: [0, 1] },
  rise:   { opacity: [0, 1], y: [28, 0] },
  zoom:   { opacity: [0, 1], scale: [0.94, 1] },
  slide:  { opacity: [0, 1], x: [-36, 0] },
  blur:   { opacity: [0, 1], y: [12, 0], filter: ['blur(12px)', 'blur(0px)'] },
  spring: { opacity: [0, 1], y: [40, 0], scale: [0.96, 1] },
}

export default function SiteMotion({ animation, parallax, textReveal }: {
  animation: SiteAnimation; parallax: boolean; textReveal: boolean
}) {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.bnb-site')
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cleanups: VoidFunction[] = []

    if (animation !== 'none' || textReveal) root.classList.add('motion-ready')

    if (animation !== 'none') {
      const keyframes = REVEAL[animation]
      const transition = animation === 'spring'
        ? { type: 'spring' as const, bounce: 0.35, duration: 0.8 }
        : { duration: 0.7, ease: [0.2, 0.7, 0.2, 1] as const }

      const watch = () => root.querySelectorAll<HTMLElement>('[data-reveal]:not([data-revealed])').forEach(el => {
        el.dataset.revealed = ''
        cleanups.push(inView(el, target => {
          // 同一排卡片依在父層中的順序錯開進場
          const siblings = Array.from(target.parentElement?.children ?? []).filter(c => c.hasAttribute('data-reveal'))
          const index = Math.max(0, siblings.indexOf(target))
          target.classList.add('is-visible')
          animate(target, keyframes, { ...transition, delay: index * 0.09 })
        }, { margin: '0px 0px -8% 0px', amount: 0.08 }))
      })
      watch()
      // 之後才渲染出來的區塊（換頁、非同步載入）也要接上，否則會一直停在隱藏狀態
      const mo = new MutationObserver(watch)
      mo.observe(root, { childList: true, subtree: true })
      cleanups.push(() => mo.disconnect())

      cleanups.push(hover('.bnb-site [data-card]', el => {
        animate(el, { y: -6 }, { type: 'spring', bounce: 0.4, duration: 0.4 })
        return () => animate(el, { y: 0 }, { type: 'spring', bounce: 0.3, duration: 0.4 })
      }))
    }

    if (textReveal) {
      root.querySelectorAll<HTMLElement>('[data-split]').forEach(el => {
        const chars = el.querySelectorAll('[data-split-char]')
        if (!chars.length) return
        cleanups.push(inView(el, () => {
          animate(chars, { opacity: [0, 1], y: ['0.45em', '0em'] }, { duration: 0.5, delay: stagger(0.035), ease: 'easeOut' })
        }, { amount: 0.3 }))
      })
    }

    if (parallax) {
      root.querySelectorAll<HTMLElement>('[data-parallax]').forEach(img => {
        const target = img.parentElement ?? img
        cleanups.push(scroll(
          animate(img, { y: [0, 90], scale: [1.12, 1.12] }, { ease: 'linear' }),
          { target, offset: ['start start', 'end start'] },
        ))
      })
    }

    return () => cleanups.forEach(fn => fn())
  }, [animation, parallax, textReveal, pathname])

  return null
}
