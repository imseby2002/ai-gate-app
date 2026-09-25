import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Palette, Wand2, ImageIcon } from 'lucide-react'
import { VISUAL_TEMPLATES, CATEGORIES } from '@/lib/marketing/visual-templates'
import { VIDEO_TEMPLATES, VIDEO_CATEGORIES } from '@/lib/marketing/video-templates'
import { GRAD, BALANCE, GradText } from './_ui'

// 「視覺風格與廣告創作」展示區：行銷 /intro 與 /intro/features 共用。
// 範例圖取自站內模板預覽圖（public/images/templates），只用「視覺風格」類。
const SHOWCASE_IDS = [
  'claymodel', 'miniature', '3drender', 'popart', 'neoncyber', 'magazine',
  'luxgold', 'pastelsoft', 'pixelart', 'cinematic', 'mockupbox', 'retro90s',
]

const SHOWCASE = SHOWCASE_IDS
  .map(id => VISUAL_TEMPLATES.find(t => t.id === id))
  .filter((t): t is NonNullable<typeof t> => !!t?.previewUrl)

const STEPS = [
  { Icon: Palette, title: '選一種「感覺」', desc: '黏土、雜誌封面、黑金奢華…不用想提示詞怎麼寫。' },
  { Icon: Wand2, title: 'AI 自動組裝指令', desc: '風格、構圖、比例與負面提示一鍵組好，也能再微調。' },
  { Icon: ImageIcon, title: '產出圖文與短影音', desc: '直接生成商用高畫質圖，或套用短影音分鏡模板出片。' },
]

export function VisualStyleShowcase({ id = 'visual-styles', showDetailLink = true }: { id?: string; showDetailLink?: boolean }) {
  const visualCats = CATEGORIES.filter(c => c.key !== 'all')
  const videoCats = VIDEO_CATEGORIES.filter(c => c.key !== 'all')
  return (
    <section id={id} className="relative overflow-hidden bg-[#120c1c] text-[#f4f0fb] scroll-mt-16">
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(45% 60% at 0% 0%,rgba(240,121,92,.30),transparent 70%),radial-gradient(50% 70% at 100% 30%,rgba(123,92,240,.40),transparent 70%)' }} />
      <div className="relative max-w-6xl mx-auto px-6 py-20">
        <div className="inline-flex items-center gap-2 font-bold text-[13px] tracking-[0.14em] uppercase mb-3 text-[#ffd6c7]">
          <span className="h-[3px] w-6 rounded-full" style={{ background: GRAD }} />主打功能 · 視覺風格與廣告創作
        </div>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end mb-10">
          <div>
            <h2 className="text-[clamp(30px,5vw,50px)] font-black tracking-tight leading-[1.1]" style={BALANCE}>
              不會寫提示詞？<br /><GradText>選個感覺</GradText>就能出圖。
            </h2>
            <p className="mt-4 text-[#ece6f8] text-[17px] leading-relaxed max-w-[52ch]">
              {VISUAL_TEMPLATES.length} 種視覺風格與宣傳模板、{VIDEO_TEMPLATES.length} 款行銷短影音分鏡模板。
              選好呈現方式，AI 立即產生專業圖文與短影音。
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/[0.07] px-5 py-4 text-center">
              <div className="text-[40px] font-black leading-none"><GradText>{VISUAL_TEMPLATES.length}</GradText></div>
              <div className="mt-1.5 text-[14px] font-semibold text-[#ddd5ee]">視覺風格</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.07] px-5 py-4 text-center">
              <div className="text-[40px] font-black leading-none"><GradText>{VIDEO_TEMPLATES.length}</GradText></div>
              <div className="mt-1.5 text-[14px] font-semibold text-[#ddd5ee]">短影音分鏡</div>
            </div>
          </div>
        </div>

        {/* 風格範例圖 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {SHOWCASE.map(t => (
            <figure key={t.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <Image src={t.previewUrl!} alt={`${t.title} 風格範例`} fill sizes="(min-width:1024px) 16vw, (min-width:640px) 33vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2.5 pt-8">
                <div className="text-[14px] font-bold text-white leading-tight">{t.title}</div>
                <div className="text-[12px] text-[#ece6f8] line-clamp-1">{t.feeling}</div>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-2 text-right text-[12px] text-[#c9bfe0]">風格範例圖</div>

        {/* 三步驟 */}
        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex gap-4 rounded-2xl border border-white/15 bg-white/[0.07] p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: GRAD }}>
                <s.Icon className="h-5 w-5 text-white" />
              </span>
              <div>
                <div className="text-[13px] font-black text-[#e4d9ff]">STEP {i + 1}</div>
                <div className="text-[17px] font-black text-white">{s.title}</div>
                <p className="mt-1 text-[15px] text-[#ece6f8] leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 模板分類 */}
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white text-[#17131f] p-6">
            <div className="text-[18px] font-black mb-4">圖片風格與宣傳模板 · {visualCats.length} 大類</div>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {visualCats.map(c => (
                <li key={c.key} className="rounded-xl bg-[#f5f3f8] px-3.5 py-3">
                  <div className="text-[15px] font-black">{c.label}</div>
                  <div className="text-[13.5px] text-[#3f3a4d] leading-snug">{c.desc}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-white text-[#17131f] p-6">
            <div className="text-[18px] font-black mb-4">短影音分鏡模板 · {videoCats.length} 大類</div>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {videoCats.map(c => (
                <li key={c.key} className="rounded-xl bg-[#f5f3f8] px-3.5 py-3">
                  <div className="text-[15px] font-black">{c.label}</div>
                  <div className="text-[13.5px] text-[#3f3a4d] leading-snug">{c.desc}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className="text-[15px] font-bold text-[#ece6f8]">可用方案：出圖 CORE 起 · 短影音 PRO 起（生成依點數計）</span>
          {showDetailLink && (
            <Link href="/intro/features#templates" className="inline-flex items-center gap-1.5 text-[16px] font-black text-white underline decoration-[#e0479b] decoration-2 underline-offset-4 hover:gap-2.5 transition-all">
              看完整說明 <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
