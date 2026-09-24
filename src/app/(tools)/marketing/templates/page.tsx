'use client'

import React, { useState, useMemo, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Sparkles, Palette, Tag, Crown, Zap, Gift, MessageSquare, ShieldCheck,
  Megaphone, Search, Upload, X, Copy, Check, Download, Loader2, ArrowRight,
  Sliders, RefreshCw, Eye, ExternalLink, HelpCircle, Layers, Image as ImageIcon,
  Share2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { SocialPublishModal } from '@/components/marketing/SocialPublishModal'
import {
  VISUAL_TEMPLATES,
  CATEGORIES,
  type VisualTemplate,
  type TemplateCategory
} from '@/lib/marketing/visual-templates'

const ASPECT_RATIOS: { value: '1:1' | '4:5' | '3:4' | '16:9' | '9:16'; label: string; desc: string }[] = [
  { value: '1:1',  label: '1:1 方形',     desc: 'IG 貼文 / 電商首圖' },
  { value: '4:5',  label: '4:5 垂直貼文', desc: 'IG / FB 滿版最佳點擊' },
  { value: '3:4',  label: '3:4 經典海報', desc: '活動宣傳 / 促銷海報' },
  { value: '16:9', label: '16:9 寬螢幕',  desc: '首頁 Banner / 橫幅廣告' },
  { value: '9:16', label: '9:16 全屏直式', desc: 'IG 限動 / Reels / TikTok' },
]

export default function VisualTemplatesPage() {
  const [selectedCat, setSelectedCat] = useState<TemplateCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<VisualTemplate>(VISUAL_TEMPLATES[0])
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '3:4' | '16:9' | '9:16'>(VISUAL_TEMPLATES[0].defaultAspect)

  // 輸入狀態
  const [userPrompt, setUserPrompt] = useState('')
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 生成狀態
  const [generating, setGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [generatedResult, setGeneratedResult] = useState<{
    url: string
    positivePrompt: string
    negativePrompt: string
    aspectRatio: string
  } | null>(null)
  const [showPublishModal, setShowPublishModal] = useState(false)

  // 篩選模板
  const filteredTemplates = useMemo(() => {
    return VISUAL_TEMPLATES.filter(t => {
      const matchCat = selectedCat === 'all' || t.category === selectedCat
      const q = searchQuery.trim().toLowerCase()
      if (!q) return matchCat

      const matchQuery =
        t.title.toLowerCase().includes(q) ||
        t.feeling.toLowerCase().includes(q) ||
        t.applicability.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))

      return matchCat && matchQuery
    })
  }, [selectedCat, searchQuery])

  // 當選擇新模板時，自動套用該模板的預設長寬比
  const handleSelectTemplate = (tpl: VisualTemplate) => {
    setSelectedTemplate(tpl)
    setAspectRatio(tpl.defaultAspect)
  }

  // 處理本機圖片上傳
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('請上傳 JPG、PNG 或 WebP 圖片格式')
      return
    }

    setUploading(true)
    const reader = new FileReader()
    reader.onload = ev => {
      setUploadedImage(ev.target?.result as string)
      setUploading(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // 即時計算預覽組裝提示詞
  const previewSynthesizedPrompt = useMemo(() => {
    if (!userPrompt.trim()) return selectedTemplate.positivePrompt
    return `${selectedTemplate.positivePrompt}, featuring ${userPrompt.trim()}, high quality, commercial photography, stunning details`
  }, [selectedTemplate, userPrompt])

  // 一鍵複製提示詞
  const handleCopyPrompt = () => {
    const fullText = `【風格特徵 / 正向提示詞】：\n${previewSynthesizedPrompt}\n\n【排除特徵 / 負面提示詞】：\n${selectedTemplate.negativePrompt}\n\n【建議尺寸比例】：\n${aspectRatio}`
    navigator.clipboard.writeText(fullText)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  // 呼叫 AI 生成圖片
  const handleGenerate = async () => {
    setGenerating(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/marketing/visual-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          userPrompt: userPrompt.trim(),
          imageUrl: uploadedImage || undefined,
          aspectRatio,
          model: 'flux',
          action: 'generate_image',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失敗，請稍後再試')

      setGeneratedResult({
        url: data.url,
        positivePrompt: data.positivePrompt || previewSynthesizedPrompt,
        negativePrompt: data.negativePrompt || selectedTemplate.negativePrompt,
        aspectRatio: data.aspectRatio || aspectRatio,
      })

      // 滾動到結果展示
      setTimeout(() => {
        const el = document.getElementById('generation-result-box')
        el?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err: any) {
      setErrorMsg(err.message || '生成失敗')
    } finally {
      setGenerating(false)
    }
  }

  // 複製圖片連結
  const handleCopyLink = () => {
    if (!generatedResult?.url) return
    navigator.clipboard.writeText(generatedResult.url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50/60 dark:bg-background">
      {/* 頂部標題區 */}
      <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-purple-600 text-white px-6 py-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-200 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="h-4 w-4" />
              <span>行銷視覺風格與廣告圖創作中心</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              免記指令！只要選擇呈現感覺，立即產生專業行銷圖
            </h1>
            <p className="text-amber-100/90 text-sm mt-1 max-w-2xl leading-relaxed">
              匯聚 85 種視覺風格、促銷大檔、會員 VIP、節慶檔期與社群互動版型。挑選喜愛的氛圍感，上傳商品照與說明，AI 即刻為您打造吸睛商用視覺！
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Link href="/marketing/ai-studio">
              <Button variant="secondary" size="sm" className="gap-1.5 bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-xs font-semibold">
                <Sliders className="h-4 w-4" />
                進入視覺工坊 (進階節點)
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* 搜尋與分類選單 */}
        <div className="bg-card border rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋呈現感覺、關鍵字（如：黏土、黑五、免運、折扣、微縮、節慶...）"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-muted/40 border-muted"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="text-xs text-muted-foreground self-center">
              共顯示 <b className="text-foreground">{filteredTemplates.length}</b> 種視覺呈現風格
            </div>
          </div>

          {/* 分類按鈕列 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map(cat => {
              const active = selectedCat === cat.key
              return (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCat(cat.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                      : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 主操作區：左側模板庫 (2/3) + 右側創作產生面板 (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左側：呈現感覺卡片網格 (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                挑選畫面呈現的感覺
              </h2>
              <span className="text-xs text-muted-foreground">點擊卡片即可切換套用</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[820px] overflow-y-auto pr-1">
              {filteredTemplates.map(tpl => {
                const isSelected = selectedTemplate.id === tpl.id
                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`group relative p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-md -translate-y-0.5'
                        : 'border-border bg-card hover:border-primary/40 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      {/* 色彩亮點條與標籤 */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${tpl.gradient} shrink-0 shadow-xs`} />
                          <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                            {tpl.title}
                          </h3>
                        </div>
                        {tpl.badge && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            {tpl.badge}
                          </span>
                        )}
                      </div>

                      {/* 呈現的感覺（核心要求：大字醒目展示感官效果） */}
                      <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 text-xs font-semibold text-primary mb-2.5 leading-relaxed">
                        ✨ {tpl.feeling}
                      </div>

                      {/* 適用場景 */}
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        <span className="font-semibold text-foreground/80">適用：</span>
                        {tpl.applicability}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate pr-2">📐 建議：{tpl.defaultAspect}</span>
                      <span className={`font-semibold shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                        {isSelected ? '✓ 目前選中' : '選擇此風格 →'}
                      </span>
                    </div>
                  </div>
                )
              })}

              {filteredTemplates.length === 0 && (
                <div className="col-span-2 py-16 text-center text-muted-foreground bg-card border rounded-2xl border-dashed">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">查無符合的風格呈現感覺</p>
                  <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); setSelectedCat('all') }}>
                    重設搜尋條件
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 右側：創作工作室面板 (5 Cols，黏性固定) */}
          <div className="lg:col-span-5">
            <Card className="p-5 rounded-2xl border shadow-md space-y-5 sticky top-4 bg-card">
              {/* 目前套用的呈現感覺 */}
              <div className="pb-4 border-b space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    當前選中風格
                  </span>
                  <Badge variant="outline" className="text-[11px]">
                    {selectedTemplate.category === 'style' ? '視覺風格' : '宣傳模板'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${selectedTemplate.gradient} shrink-0 shadow-xs flex items-center justify-center text-white`}>
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">{selectedTemplate.title}</h3>
                    <p className="text-xs text-primary font-medium mt-0.5">
                      {selectedTemplate.feeling}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-lg">
                  💡 <b>特色：</b>{selectedTemplate.applicability}
                </div>
              </div>

              {/* 上傳圖片（可選/圖生圖） */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>上傳商品 / 參考圖片（選填）</span>
                  {uploadedImage && (
                    <button
                      onClick={() => setUploadedImage(null)}
                      className="text-[11px] text-rose-500 hover:underline flex items-center gap-1"
                    >
                      <X className="h-3 w-3" /> 清除圖片
                    </button>
                  )}
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {uploadedImage ? (
                  <div className="relative rounded-xl overflow-hidden border bg-black/5 dark:bg-black/30 group">
                    <img
                      src={uploadedImage}
                      alt="Uploaded preview"
                      className="w-full h-36 object-contain"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs gap-1"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        更換圖片
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 text-xs"
                        onClick={() => setUploadedImage(null)}
                      >
                        刪除
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-4 text-center cursor-pointer transition-colors bg-muted/10 hover:bg-muted/30 flex flex-col items-center justify-center gap-1.5"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">點擊或拖曳上傳圖片</span>
                    <span className="text-[11px] text-muted-foreground">
                      可上傳商品主照、門市照；AI 將依所選風格自動合成（未上傳則由文字生成）
                    </span>
                  </div>
                )}
              </div>

              {/* 內容與說明填寫 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>商品名稱與內容說明</span>
                  <span className="text-[11px] text-muted-foreground font-normal">可用中文填寫</span>
                </label>
                <Textarea
                  placeholder="例如：特調黑糖珍珠鮮奶茶，滿滿冰塊與琥珀流動黑糖紋路，背景是溫潤木質吧檯，杯頂有鮮奶油與黑糖粉..."
                  value={userPrompt}
                  onChange={e => setUserPrompt(e.target.value)}
                  className="h-24 text-xs resize-none rounded-xl"
                />
              </div>

              {/* 長寬比選擇 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground block">
                  生成尺寸比例
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {ASPECT_RATIOS.map(ar => {
                    const active = aspectRatio === ar.value
                    const isDefault = selectedTemplate.defaultAspect === ar.value
                    return (
                      <button
                        key={ar.value}
                        onClick={() => setAspectRatio(ar.value)}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center relative ${
                          active
                            ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                            : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
                        }`}
                      >
                        {isDefault && (
                          <span className="absolute -top-1.5 -right-1 text-[9px] px-1 bg-amber-500 text-white rounded-full font-semibold">
                            推薦
                          </span>
                        )}
                        <span className="text-xs font-mono">{ar.value}</span>
                        <span className="text-[10px] scale-90 truncate max-w-full opacity-80">{ar.label.split(' ')[1]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 即時組裝提示詞骨架 (點選可展開或複製) */}
              <div className="p-3 bg-muted/30 border rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Sliders className="h-3.5 w-3.5 text-primary" />
                    已組裝提示詞骨架
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[11px] gap-1 px-2 text-primary"
                    onClick={handleCopyPrompt}
                  >
                    {copiedPrompt ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    {copiedPrompt ? '已複製' : '複製 Prompt'}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono line-clamp-3 bg-card p-2 rounded border">
                  {previewSynthesizedPrompt}
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* 核心操作按鈕 */}
              <div className="space-y-2 pt-1">
                <Button
                  onClick={handleGenerate}
                  disabled={generating || uploading}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:from-amber-600 hover:via-rose-600 hover:to-purple-700 text-white font-bold shadow-md gap-2"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>AI 正在全力繪製行銷大片中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>🚀 AI 立即生成此風格行銷圖</span>
                    </>
                  )}
                </Button>

                <p className="text-[11px] text-center text-muted-foreground">
                  已自動封裝「{selectedTemplate.feeling}」專業光影、視角與質感參數
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* 生成成果展示區塊 */}
        {generatedResult && (
          <div id="generation-result-box" className="mt-8 pt-6 border-t space-y-4 animate-in fade-in-50 duration-300">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">AI 行銷圖產出完成！</h3>
                  <p className="text-xs text-muted-foreground">風格：{selectedTemplate.title}（{selectedTemplate.feeling}）</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-8 text-xs gap-1.5"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedLink ? '已複製連結' : '複製圖片連結'}
                </Button>

                <a
                  href={generatedResult.url}
                  download={`marketing-${selectedTemplate.id}-${Date.now()}.png`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                    <Download className="h-3.5 w-3.5" />
                    下載高畫質大圖
                  </Button>
                </a>

                <Button
                  size="sm"
                  onClick={() => setShowPublishModal(true)}
                  className="h-8 text-xs gap-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-sm"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  🚀 一鍵串接上傳至社群平台
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-card border rounded-2xl p-5 shadow-sm">
              {/* 大圖預覽 */}
              <div className="md:col-span-7 flex items-center justify-center bg-black/5 dark:bg-black/40 rounded-xl overflow-hidden p-2 min-h-[360px]">
                <img
                  src={generatedResult.url}
                  alt="Generated Result"
                  className="max-h-[520px] w-auto object-contain rounded-lg shadow-md"
                />
              </div>

              {/* 圖片詳細資訊與二次創作引導 */}
              <div className="md:col-span-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 text-xs">
                    <div className="font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      所採用的完整提示詞骨架
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground leading-relaxed max-h-36 overflow-y-auto bg-card p-2 rounded border">
                      {generatedResult.positivePrompt}
                    </p>
                  </div>

                  <div className="p-3 bg-muted/40 rounded-xl space-y-1 text-xs">
                    <div className="font-bold text-foreground">負面排除特徵 (Negative)</div>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {generatedResult.negativePrompt}
                    </p>
                  </div>

                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>尺寸比例：<b className="text-foreground">{generatedResult.aspectRatio}</b></span>
                    <span>•</span>
                    <span>存儲狀態：<b className="text-emerald-600">已自動存入素材庫</b></span>
                  </div>

                  {/* 社群發布中心推薦卡 */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                        <Share2 className="h-3.5 w-3.5" />
                        社群發布中心一鍵串接
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-300">
                        直發多平台
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      免手動下載轉存！立即將這張成果圖同步發布至 Facebook、Instagram、Threads 等社群平台。
                    </p>
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                      onClick={() => setShowPublishModal(true)}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      開啟上傳中心並選擇發布平台
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t">
                  <Button
                    variant="outline"
                    className="w-full text-xs font-semibold gap-1.5"
                    onClick={handleGenerate}
                    disabled={generating}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
                    以相同參數重新生成一張 (產生變化)
                  </Button>
                  <Link href="/marketing/ai-studio">
                    <Button variant="ghost" className="w-full text-xs text-primary gap-1">
                      帶入視覺工坊進一步去背、局部修改或轉為短影音 →
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 社群平台發布 Modal */}
      {generatedResult && (
        <SocialPublishModal
          open={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          media={{
            type: 'image',
            url: generatedResult.url,
            title: `${selectedTemplate.title}（${selectedTemplate.feeling}）`,
            aspectRatio: generatedResult.aspectRatio,
          }}
          initialCopy={`✨【${selectedTemplate.title}】新視覺公開！\n\n以「${selectedTemplate.feeling}」專屬風格打造，呈現極致質感與細節魅力 🔥${userPrompt.trim() ? `\n\n重點特色：${userPrompt.trim()}` : ''}\n\n立即了解更多或私訊我們！\n\n#品牌視覺 #新品上市 #行銷設計 #社群亮點 #質感生活`}
          sourceName={`視覺風格與廣告圖 (${selectedTemplate.title})`}
        />
      )}
    </div>
  )
}
