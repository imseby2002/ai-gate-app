'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, Upload, Sparkles, CheckCircle2, Loader2,
  LayoutGrid, BarChart3, FileText, Image as ImageIcon,
  ChevronDown, ChevronUp, Copy, RefreshCw, Download,
  Megaphone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductAnalysis {
  name: string
  category: string
  key_features: string[]
  core_value: string
}

interface MarketingRoute {
  route_name: string
  target_audience: string
  headline: string
  subhead: string
  brand_tone: string
  visual_style: string
  key_message: string
  image_prompts: string[]
  persuasion_angle: string
}

interface ContentItem {
  id: string
  type: string
  ratio: string
  title: string
  headline: string
  body_copy: string
  cta_text: string
  visual_prompt_en: string
  visual_summary: string
  aida_stage: string
  generatedImageUrl?: string
  generatingImage?: boolean
}

interface MarketAnalysis {
  core_value: { statement: string; differentiators: string[]; proof_points: string[] }
  market_positioning: { category: string; price_tier: string; positioning_statement: string; market_size_estimate: string; growth_trend: string }
  competitors: Array<{ name: string; strengths: string[]; weaknesses: string[]; our_advantage: string }>
  buyer_personas: Array<{ name: string; age_range: string; occupation: string; pain_points: string[]; motivations: string[]; search_keywords: string[]; preferred_platforms: string[]; buying_trigger: string }>
  regional_insights: { primary_market: string; trends: string[]; seasonal_factors: string[]; cultural_notes: string }
}

interface ContentStrategy {
  seo_topics: Array<{ title: string; keyword: string; search_intent: string; outline: string[]; estimated_volume: string }>
  content_calendar: Array<{ week: number; theme: string; platforms: string[]; content_types: string[]; key_message: string }>
  cta_variants: Array<{ type: string; text: string; context: string }>
  interactive_elements: Array<{ type: string; topic: string; platform: string }>
  ai_studio_prompts: Array<{ purpose: string; prompt: string }>
  gamma_prompts: Array<{ title: string; prompt: string }>
  hashtag_strategy: { brand_tags: string[]; industry_tags: string[]; trending_tags: string[] }
}

// ─── Step Config ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: '策略規劃', icon: Sparkles, desc: '分析產品，生成 3 條行銷路線' },
  { id: 2, label: '內容組合', icon: LayoutGrid, desc: '8 件 AIDA 行銷素材' },
  { id: 3, label: '市場分析', icon: BarChart3, desc: '競品、受眾、市場定位' },
  { id: 4, label: '內容策略', icon: FileText, desc: 'SEO、CTA、排程計畫' },
]

const AIDA_COLORS: Record<string, string> = {
  A: 'bg-red-100 text-red-700',
  I: 'bg-orange-100 text-orange-700',
  D: 'bg-violet-100 text-violet-700',
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ProductDesignerPage() {
  const [activeStep, setActiveStep] = useState(1)

  // Form state
  const [productName, setProductName] = useState('')
  const [description, setDescription] = useState('')
  const [industry, setIndustry] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Phase results
  const [productAnalysis, setProductAnalysis] = useState<ProductAnalysis | null>(null)
  const [routes, setRoutes] = useState<MarketingRoute[]>([])
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number | null>(null)
  const [contentItems, setContentItems] = useState<ContentItem[]>([])
  const [marketAnalysis, setMarketAnalysis] = useState<MarketAnalysis | null>(null)
  const [contentStrategy, setContentStrategy] = useState<ContentStrategy | null>(null)

  // Loading states
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<Record<number, string>>({})

  const setPhaseLoading = (phase: number, v: boolean) => setLoading(p => ({ ...p, [phase]: v }))
  const setPhaseError = (phase: number, msg: string) => setError(p => ({ ...p, [phase]: msg }))

  // Image file pick
  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const toBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => {
        const result = r.result as string
        res(result.split(',')[1])
      }
      r.onerror = rej
      r.readAsDataURL(file)
    })

  // Phase 1 — Analyze
  const runPhase1 = async () => {
    if (!productName.trim()) { setPhaseError(1, '請輸入產品名稱'); return }
    setPhaseLoading(1, true); setPhaseError(1, '')
    try {
      let imageBase64: string | undefined
      let imageMimeType: string | undefined
      if (imageFile) {
        imageBase64 = await toBase64(imageFile)
        imageMimeType = imageFile.type
      }
      const res = await fetch('/api/marketing/product-designer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName, description, industry, targetAudience, imageBase64, imageMimeType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProductAnalysis(data.product_analysis)
      setRoutes(data.routes ?? [])
      setSelectedRouteIdx(0)
    } catch (e) {
      setPhaseError(1, String(e))
    } finally {
      setPhaseLoading(1, false)
    }
  }

  // Phase 2 — Content Plan
  const runPhase2 = async () => {
    if (selectedRouteIdx === null) { setPhaseError(2, '請先選擇行銷路線'); return }
    setPhaseLoading(2, true); setPhaseError(2, '')
    try {
      const res = await fetch('/api/marketing/product-designer/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productAnalysis, selectedRoute: routes[selectedRouteIdx], productName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setContentItems(data.items ?? [])
    } catch (e) {
      setPhaseError(2, String(e))
    } finally {
      setPhaseLoading(2, false)
    }
  }

  // Phase 3 — Market Analysis
  const runPhase3 = async () => {
    setPhaseLoading(3, true); setPhaseError(3, '')
    try {
      const res = await fetch('/api/marketing/product-designer/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName, description, industry, targetAudience, productAnalysis, selectedRoute: selectedRouteIdx !== null ? routes[selectedRouteIdx] : null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMarketAnalysis(data)
    } catch (e) {
      setPhaseError(3, String(e))
    } finally {
      setPhaseLoading(3, false)
    }
  }

  // Phase 4 — Content Strategy
  const runPhase4 = async () => {
    setPhaseLoading(4, true); setPhaseError(4, '')
    try {
      const res = await fetch('/api/marketing/product-designer/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName, industry, productAnalysis, selectedRoute: selectedRouteIdx !== null ? routes[selectedRouteIdx] : null, marketAnalysis }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setContentStrategy(data)
    } catch (e) {
      setPhaseError(4, String(e))
    } finally {
      setPhaseLoading(4, false)
    }
  }

  // Generate image for a content item
  const generateItemImage = async (idx: number) => {
    const item = contentItems[idx]
    if (!item) return
    setContentItems(prev => prev.map((it, i) => i === idx ? { ...it, generatingImage: true } : it))
    try {
      const res = await fetch('/api/marketing/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: item.visual_prompt_en, scriptId: idx, model: 'flux', size: item.ratio === '1:1' ? '1:1' : '9:16' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setContentItems(prev => prev.map((it, i) => i === idx ? { ...it, generatedImageUrl: data.url, generatingImage: false } : it))
    } catch (e) {
      setContentItems(prev => prev.map((it, i) => i === idx ? { ...it, generatingImage: false } : it))
    }
  }

  const canGoStep = (step: number) => {
    if (step === 1) return true
    if (step === 2) return routes.length > 0
    if (step === 3) return routes.length > 0
    if (step === 4) return routes.length > 0
    return false
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50/50 dark:bg-background">
      {/* Header */}
      <div className="shrink-0 border-b bg-white dark:bg-card px-4 py-3 flex items-center gap-3">
        <Link href="/marketing" className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors">
          <ChevronLeft className="h-4 w-4" />
          行銷中心
        </Link>
        <span className="text-muted-foreground">/</span>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm">AI 產品行銷設計師</span>
        </div>
      </div>

      {/* Step tabs */}
      <div className="shrink-0 border-b bg-white dark:bg-card px-4">
        <div className="flex gap-0">
          {STEPS.map((step, idx) => {
            const Icon = step.icon
            const done = routes.length > 0 && step.id === 1
              || contentItems.length > 0 && step.id === 2
              || marketAnalysis && step.id === 3
              || contentStrategy && step.id === 4
            const active = activeStep === step.id
            const canGo = canGoStep(step.id)
            return (
              <button
                key={step.id}
                onClick={() => canGo && setActiveStep(step.id)}
                disabled={!canGo}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
                  canGo && !active ? 'hover:text-foreground hover:border-border' : '',
                  !canGo ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <span className={cn('h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold', active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>
                    {idx + 1}
                  </span>
                )}
                <span className="hidden sm:block">{step.label}</span>
                <Icon className="h-3.5 w-3.5 sm:hidden" />
              </button>
            )
          })}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          {/* ── STEP 1: Strategy Director ── */}
          {activeStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold">第一步：策略規劃</h2>
                <p className="text-sm text-muted-foreground mt-0.5">輸入產品資訊，AI 生成 3 條截然不同的行銷路線</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Form */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">產品名稱 *</label>
                    <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="例：AIR MAX 跑鞋" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">產業類別</label>
                    <Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="例：運動用品、美妝保養、食品飲料" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">產品描述</label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="描述產品特點、功能、材質、使用情境..." rows={3} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">目標客群</label>
                    <Input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="例：25-40 歲都市女性白領" />
                  </div>
                </div>

                {/* Right: Image upload */}
                <div>
                  <label className="text-sm font-medium mb-1 block">產品圖片（選填，提升分析準確度）</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={cn(
                      'relative border-2 border-dashed rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2 text-center',
                      imagePreview ? 'border-primary/40 p-2' : 'border-border hover:border-primary/40 p-10',
                    )}
                  >
                    {imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagePreview} alt="product" className="max-h-52 max-w-full object-contain rounded-lg" />
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-medium">點擊上傳產品圖</p>
                        <p className="text-xs text-muted-foreground">JPG / PNG / WebP，建議 1:1</p>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
                  {imagePreview && (
                    <button className="text-xs text-muted-foreground mt-1 hover:text-foreground" onClick={() => { setImageFile(null); setImagePreview(null) }}>移除圖片</button>
                  )}
                </div>
              </div>

              {error[1] && <p className="text-sm text-red-500">{error[1]}</p>}

              <Button onClick={runPhase1} disabled={loading[1]} className="gap-2">
                {loading[1] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading[1] ? '分析中...' : '生成行銷策略'}
              </Button>

              {/* Results: 3 routes */}
              {routes.length > 0 && (
                <div className="space-y-4">
                  {productAnalysis && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-1">產品分析完成</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">核心價值：{productAnalysis.core_value}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {productAnalysis.key_features.map(f => (
                          <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <h3 className="font-semibold">選擇行銷路線</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {routes.map((route, idx) => (
                      <RouteCard
                        key={idx}
                        route={route}
                        selected={selectedRouteIdx === idx}
                        onSelect={() => setSelectedRouteIdx(idx)}
                      />
                    ))}
                  </div>

                  {selectedRouteIdx !== null && (
                    <div className="flex gap-3 pt-2">
                      <Button onClick={() => setActiveStep(2)} className="gap-2">
                        下一步：內容組合
                        <Sparkles className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" onClick={() => setActiveStep(3)} className="gap-2">
                        跳至：市場分析
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Content Suite ── */}
          {activeStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">第二步：內容組合</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">根據選定路線生成 8 件 AIDA 行銷素材</p>
                </div>
                {selectedRouteIdx !== null && routes[selectedRouteIdx] && (
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground text-xs">使用路線</p>
                    <p className="font-semibold">{routes[selectedRouteIdx].route_name}</p>
                  </div>
                )}
              </div>

              {error[2] && <p className="text-sm text-red-500">{error[2]}</p>}

              <Button onClick={runPhase2} disabled={loading[2]} className="gap-2">
                {loading[2] ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutGrid className="h-4 w-4" />}
                {loading[2] ? '生成中...' : contentItems.length > 0 ? '重新生成' : '生成內容組合'}
              </Button>

              {contentItems.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contentItems.map((item, idx) => (
                    <ContentItemCard key={item.id} item={item} onGenerateImage={() => generateItemImage(idx)} />
                  ))}
                </div>
              )}

              {contentItems.length > 0 && (
                <Button variant="outline" onClick={() => setActiveStep(3)} className="gap-2">
                  下一步：市場分析 <BarChart3 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* ── STEP 3: Market Analysis ── */}
          {activeStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold">第三步：市場分析</h2>
                <p className="text-sm text-muted-foreground mt-0.5">競品分析、買家畫像、市場定位</p>
              </div>

              {error[3] && <p className="text-sm text-red-500">{error[3]}</p>}

              <Button onClick={runPhase3} disabled={loading[3]} className="gap-2">
                {loading[3] ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                {loading[3] ? '分析中...' : marketAnalysis ? '重新分析' : '執行市場分析'}
              </Button>

              {marketAnalysis && <MarketAnalysisView data={marketAnalysis} />}

              {marketAnalysis && (
                <Button variant="outline" onClick={() => setActiveStep(4)} className="gap-2">
                  下一步：內容策略 <FileText className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* ── STEP 4: Content Strategy ── */}
          {activeStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold">第四步：內容策略</h2>
                <p className="text-sm text-muted-foreground mt-0.5">SEO 主題、發文行事曆、CTA 變體、AI Studio 提示詞</p>
              </div>

              {error[4] && <p className="text-sm text-red-500">{error[4]}</p>}

              <Button onClick={runPhase4} disabled={loading[4]} className="gap-2">
                {loading[4] ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {loading[4] ? '生成中...' : contentStrategy ? '重新生成' : '生成內容策略'}
              </Button>

              {contentStrategy && <ContentStrategyView data={contentStrategy} />}

              {contentStrategy && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 rounded-xl text-sm text-emerald-700 dark:text-emerald-400">
                  <p className="font-semibold mb-1">完成！</p>
                  <p>所有 4 個階段已完成。前往<Link href="/marketing-auto" className="underline mx-1">行銷自動化</Link>將素材投入全流程自動化執行。</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Sub Components ────────────────────────────────────────────────────────────

function RouteCard({ route, selected, onSelect }: { route: MarketingRoute; selected: boolean; onSelect: () => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      onClick={onSelect}
      className={cn(
        'border-2 rounded-xl p-4 cursor-pointer transition-all',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={cn('h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5', selected ? 'border-primary' : 'border-muted-foreground')}>
          {selected && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
        </div>
        <span className="text-xs font-medium text-muted-foreground ml-2 text-right">{route.brand_tone}</span>
      </div>
      <p className="font-bold text-sm mb-0.5">{route.route_name}</p>
      <p className="text-primary font-semibold text-sm mb-1">{route.headline}</p>
      <p className="text-xs text-muted-foreground mb-2">{route.subhead}</p>
      <p className="text-xs text-muted-foreground">受眾：{route.target_audience}</p>

      <button
        onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}
        className="flex items-center gap-1 text-xs text-muted-foreground mt-2 hover:text-foreground"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? '收合' : '查看詳情'}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 text-xs text-muted-foreground border-t pt-2">
          <p><span className="font-medium text-foreground">訴求：</span>{route.key_message}</p>
          <p><span className="font-medium text-foreground">視覺：</span>{route.visual_style}</p>
          <p><span className="font-medium text-foreground">說服角度：</span>{route.persuasion_angle}</p>
          <div>
            <p className="font-medium text-foreground mb-1">圖片提示詞：</p>
            {route.image_prompts.map((p, i) => (
              <p key={i} className="bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 mb-1">{p}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ContentItemCard({ item, onGenerateImage }: { item: ContentItem; onGenerateImage: () => void }) {
  const [showPrompt, setShowPrompt] = useState(false)
  const aidaLabel = item.aida_stage === 'A' ? '注意' : item.aida_stage === 'I' ? '興趣' : item.aida_stage === 'D' ? '慾望' : '行動'
  const aidaColor = AIDA_COLORS[item.aida_stage] ?? 'bg-blue-100 text-blue-700'

  return (
    <div className="border rounded-xl bg-white dark:bg-card overflow-hidden">
      {item.generatedImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.generatedImageUrl} alt={item.title} className={cn('w-full object-cover', item.ratio === '9:16' ? 'aspect-[9/16]' : 'aspect-square')} />
      ) : (
        <div className={cn('bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted-foreground', item.ratio === '9:16' ? 'aspect-[9/16]' : 'aspect-square')}>
          <div className="text-center p-4">
            <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">{item.ratio}</p>
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', aidaColor)}>{aidaLabel}</span>
          <span className="text-[10px] text-muted-foreground">{item.ratio}</span>
        </div>
        <p className="font-semibold text-sm mb-1">{item.title}</p>
        <p className="text-primary font-bold text-sm mb-1">{item.headline}</p>
        <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{item.body_copy}</p>
        <p className="text-xs font-medium bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded mb-3">{item.cta_text}</p>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={onGenerateImage} disabled={item.generatingImage}>
            {item.generatingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
            生成圖片
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setShowPrompt(!showPrompt)}>
            {showPrompt ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {showPrompt && (
          <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-800 rounded p-2 relative">
            <p className="text-muted-foreground mb-1 font-medium">圖片提示詞：</p>
            <p className="leading-relaxed pr-6">{item.visual_prompt_en}</p>
            <button
              onClick={() => navigator.clipboard.writeText(item.visual_prompt_en)}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3 w-3" />
            </button>
            <p className="text-muted-foreground mt-2 font-medium">視覺摘要：</p>
            <p>{item.visual_summary}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function MarketAnalysisView({ data }: { data: MarketAnalysis }) {
  return (
    <div className="space-y-4">
      {/* Core value */}
      <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
        <p className="font-semibold text-violet-800 dark:text-violet-300 mb-1">核心價值主張</p>
        <p className="text-sm font-bold text-violet-700 dark:text-violet-400 mb-2">{data.core_value?.statement}</p>
        <div className="flex flex-wrap gap-1.5">
          {data.core_value?.differentiators?.map(d => (
            <span key={d} className="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">{d}</span>
          ))}
        </div>
      </div>

      {/* Market positioning */}
      <div className="border rounded-xl p-4">
        <p className="font-semibold mb-2">市場定位</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground text-xs">市場類別</p><p className="font-medium">{data.market_positioning?.category}</p></div>
          <div><p className="text-muted-foreground text-xs">價格區間</p><p className="font-medium">{data.market_positioning?.price_tier}</p></div>
          <div className="col-span-2"><p className="text-muted-foreground text-xs">定位宣言</p><p className="font-medium">{data.market_positioning?.positioning_statement}</p></div>
          <div><p className="text-muted-foreground text-xs">市場規模</p><p className="font-medium">{data.market_positioning?.market_size_estimate}</p></div>
          <div><p className="text-muted-foreground text-xs">趨勢</p><p className="font-medium">{data.market_positioning?.growth_trend}</p></div>
        </div>
      </div>

      {/* Competitors */}
      {data.competitors?.length > 0 && (
        <div className="border rounded-xl p-4">
          <p className="font-semibold mb-3">競爭對手分析</p>
          <div className="space-y-3">
            {data.competitors.map((c, i) => (
              <div key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <p className="font-semibold text-sm mb-1">{c.name}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-emerald-600 font-medium mb-0.5">優勢</p>
                    {c.strengths?.map(s => <p key={s} className="text-muted-foreground">• {s}</p>)}
                  </div>
                  <div>
                    <p className="text-red-500 font-medium mb-0.5">弱點</p>
                    {c.weaknesses?.map(w => <p key={w} className="text-muted-foreground">• {w}</p>)}
                  </div>
                  <div>
                    <p className="text-primary font-medium mb-0.5">我方優勢</p>
                    <p className="text-muted-foreground">{c.our_advantage}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buyer personas */}
      {data.buyer_personas?.length > 0 && (
        <div className="border rounded-xl p-4">
          <p className="font-semibold mb-3">買家畫像</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.buyer_personas.map((p, i) => (
              <div key={i} className="border rounded-lg p-3 text-sm">
                <p className="font-bold mb-0.5">{p.name}</p>
                <p className="text-xs text-muted-foreground mb-2">{p.age_range} · {p.occupation}</p>
                <p className="text-xs font-medium text-red-500 mb-0.5">痛點</p>
                {p.pain_points?.map(pt => <p key={pt} className="text-xs text-muted-foreground">• {pt}</p>)}
                <p className="text-xs font-medium text-emerald-600 mt-1.5 mb-0.5">動機</p>
                {p.motivations?.map(m => <p key={m} className="text-xs text-muted-foreground">• {m}</p>)}
                <p className="text-xs font-medium text-primary mt-1.5 mb-0.5">搜尋關鍵字</p>
                <div className="flex flex-wrap gap-1">
                  {p.search_keywords?.map(k => <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{k}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ContentStrategyView({ data }: { data: ContentStrategy }) {
  return (
    <div className="space-y-4">
      {/* SEO Topics */}
      {data.seo_topics?.length > 0 && (
        <div className="border rounded-xl p-4">
          <p className="font-semibold mb-3">SEO 文章主題</p>
          <div className="space-y-3">
            {data.seo_topics.map((t, i) => (
              <div key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-semibold text-sm">{t.title}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 ml-2 shrink-0">{t.search_intent}</span>
                </div>
                <p className="text-xs text-primary mb-1">關鍵字：{t.keyword} · {t.estimated_volume}</p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {t.outline?.map((o, j) => <p key={j}>• {o}</p>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA Variants */}
      {data.cta_variants?.length > 0 && (
        <div className="border rounded-xl p-4">
          <p className="font-semibold mb-3">CTA 行動呼籲變體</p>
          <div className="space-y-2">
            {data.cta_variants.map((c, i) => (
              <div key={i} className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0 mt-0.5">{c.type}</span>
                <div>
                  <p className="font-semibold text-sm">{c.text}</p>
                  <p className="text-xs text-muted-foreground">{c.context}</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText(c.text)} className="ml-auto text-muted-foreground hover:text-foreground shrink-0">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Calendar */}
      {data.content_calendar?.length > 0 && (
        <div className="border rounded-xl p-4">
          <p className="font-semibold mb-3">發文行事曆（4 週）</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.content_calendar.map((w, i) => (
              <div key={i} className="border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">第 {w.week} 週</p>
                <p className="font-semibold text-sm mb-1">{w.theme}</p>
                <p className="text-xs text-muted-foreground mb-1.5">{w.key_message}</p>
                <div className="flex flex-wrap gap-1">
                  {w.platforms?.map(p => <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{p}</span>)}
                  {w.content_types?.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-muted-foreground">{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Studio Prompts */}
      {data.ai_studio_prompts?.length > 0 && (
        <div className="border rounded-xl p-4">
          <p className="font-semibold mb-3">AI Studio 登陸頁提示詞</p>
          <div className="space-y-3">
            {data.ai_studio_prompts.map((p, i) => (
              <div key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{p.purpose}</p>
                  <button onClick={() => navigator.clipboard.writeText(p.prompt)} className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{p.prompt}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hashtags */}
      {data.hashtag_strategy && (
        <div className="border rounded-xl p-4">
          <p className="font-semibold mb-3">Hashtag 策略</p>
          <div className="space-y-2">
            {[
              { label: '品牌標籤', tags: data.hashtag_strategy.brand_tags, color: 'bg-violet-100 text-violet-700' },
              { label: '行業標籤', tags: data.hashtag_strategy.industry_tags, color: 'bg-blue-100 text-blue-700' },
              { label: '熱門標籤', tags: data.hashtag_strategy.trending_tags, color: 'bg-orange-100 text-orange-700' },
            ].map(group => (
              <div key={group.label}>
                <p className="text-xs text-muted-foreground mb-1">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.tags?.map(tag => (
                    <span key={tag} className={cn('text-xs px-2 py-0.5 rounded-full', group.color)}>#{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
