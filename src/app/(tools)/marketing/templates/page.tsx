'use client'

import React, { useState, useMemo, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Sparkles, Palette, Tag, Crown, Zap, Gift, MessageSquare, ShieldCheck,
  Megaphone, Search, Upload, X, Copy, Check, Download, Loader2, ArrowRight,
  Sliders, RefreshCw, Eye, ExternalLink, HelpCircle, Layers, Image as ImageIcon,
  Share2, Video, Film, Flame, Box, BookOpen, Clock, Smartphone, Monitor,
  Play, FileText, CheckCircle2, AlertCircle, Send
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { SocialPublishModal } from '@/components/marketing/SocialPublishModal'
import {
  VISUAL_TEMPLATES,
  CATEGORIES as IMAGE_CATEGORIES,
  type VisualTemplate,
  type TemplateCategory as ImageTemplateCategory
} from '@/lib/marketing/visual-templates'
import {
  VIDEO_TEMPLATES,
  VIDEO_CATEGORIES,
  type VideoTemplate,
  type VideoCategory
} from '@/lib/marketing/video-templates'

const ASPECT_RATIOS: { value: '1:1' | '4:5' | '3:4' | '16:9' | '9:16'; label: string; desc: string }[] = [
  { value: '1:1',  label: '1:1 方形',     desc: 'IG 貼文 / 電商首圖' },
  { value: '4:5',  label: '4:5 垂直貼文', desc: 'IG / FB 滿版最佳點擊' },
  { value: '3:4',  label: '3:4 經典海報', desc: '活動宣傳 / 促銷海報' },
  { value: '16:9', label: '16:9 寬螢幕',  desc: '首頁 Banner / 橫幅廣告' },
  { value: '9:16', label: '9:16 全屏直式', desc: 'IG 限動 / Reels / TikTok' },
]

export default function VisualTemplatesPage() {
  // 主分頁切換：'image' (圖片風格模板) 或 'video' (影片廣告腳本)
  const [mainTab, setMainTab] = useState<'image' | 'video'>('image')

  // ─── 圖片模式狀態 ───────────────────────────────────────────────
  const [selectedImgCat, setSelectedImgCat] = useState<ImageTemplateCategory>('all')
  const [imgSearchQuery, setImgSearchQuery] = useState('')
  const [selectedImgTemplate, setSelectedImgTemplate] = useState<VisualTemplate>(VISUAL_TEMPLATES[0])
  const [imgAspectRatio, setImgAspectRatio] = useState<'1:1' | '4:5' | '3:4' | '16:9' | '9:16'>(VISUAL_TEMPLATES[0].defaultAspect)

  const [imgUserPrompt, setImgUserPrompt] = useState('')
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const imgFileInputRef = useRef<HTMLInputElement>(null)

  const [generatingImage, setGeneratingImage] = useState(false)
  const [imgErrorMsg, setImgErrorMsg] = useState<string | null>(null)
  const [copiedImgPrompt, setCopiedImgPrompt] = useState(false)
  const [copiedImgLink, setCopiedImgLink] = useState(false)
  const [generatedImgResult, setGeneratedImgResult] = useState<{
    url: string
    positivePrompt: string
    negativePrompt: string
    aspectRatio: string
  } | null>(null)
  const [showImgPublishModal, setShowImgPublishModal] = useState(false)
  const [previewModalTpl, setPreviewModalTpl] = useState<VisualTemplate | null>(null)

  // ─── 影片模式狀態 ───────────────────────────────────────────────
  const [selectedVideoCat, setSelectedVideoCat] = useState<VideoCategory>('all')
  const [videoSearchQuery, setVideoSearchQuery] = useState('')
  const [selectedVideoTemplate, setSelectedVideoTemplate] = useState<VideoTemplate>(VIDEO_TEMPLATES[0])
  const [videoAspect, setVideoAspect] = useState<'9:16' | '16:9' | '1:1' | '4:5'>(VIDEO_TEMPLATES[0].defaultAspect)
  const [videoProductName, setVideoProductName] = useState('')
  const [videoKeyPoint, setVideoKeyPoint] = useState('')
  
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [videoPollStatus, setVideoPollStatus] = useState<string | null>(null)
  const [videoErrorMsg, setVideoErrorMsg] = useState<string | null>(null)
  const [videoResultUrl, setVideoResultUrl] = useState<string | null>(null)
  const [copiedVideoScript, setCopiedVideoScript] = useState(false)
  const [copiedVideoPrompt, setCopiedVideoPrompt] = useState(false)
  const [expandedAiScript, setExpandedAiScript] = useState<string | null>(null)
  const [expandingAiScript, setExpandingAiScript] = useState(false)
  const [showVideoPublishModal, setShowVideoPublishModal] = useState(false)

  // ─── 圖片篩選 ───────────────────────────────────────────────────
  const filteredImgTemplates = useMemo(() => {
    return VISUAL_TEMPLATES.filter(t => {
      const matchCat = selectedImgCat === 'all' || t.category === selectedImgCat
      const q = imgSearchQuery.trim().toLowerCase()
      if (!q) return matchCat

      const matchQuery =
        t.title.toLowerCase().includes(q) ||
        t.feeling.toLowerCase().includes(q) ||
        t.applicability.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))

      return matchCat && matchQuery
    })
  }, [selectedImgCat, imgSearchQuery])

  // ─── 影片篩選 ───────────────────────────────────────────────────
  const filteredVideoTemplates = useMemo(() => {
    return VIDEO_TEMPLATES.filter(t => {
      const matchCat = selectedVideoCat === 'all' || t.category === selectedVideoCat
      const q = videoSearchQuery.trim().toLowerCase()
      if (!q) return matchCat

      const matchQuery =
        t.command.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.applicability.toLowerCase().includes(q) ||
        t.params.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))

      return matchCat && matchQuery
    })
  }, [selectedVideoCat, videoSearchQuery])

  // 選擇圖片模板
  const handleSelectImgTemplate = (tpl: VisualTemplate) => {
    setSelectedImgTemplate(tpl)
    setImgAspectRatio(tpl.defaultAspect)
  }

  // 選擇影片模板
  const handleSelectVideoTemplate = (tpl: VideoTemplate) => {
    setSelectedVideoTemplate(tpl)
    setVideoAspect(tpl.defaultAspect)
    setVideoResultUrl(null)
    setExpandedAiScript(null)
    setVideoErrorMsg(null)
  }

  // 處理本機圖片上傳
  const handleImgFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('請上傳 JPG、PNG 或 WebP 圖片格式')
      return
    }

    setUploadingImage(true)
    const reader = new FileReader()
    reader.onload = ev => {
      setUploadedImage(ev.target?.result as string)
      setUploadingImage(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // 即時計算圖片提示詞
  const previewSynthesizedImgPrompt = useMemo(() => {
    if (!imgUserPrompt.trim()) return selectedImgTemplate.positivePrompt
    return `${selectedImgTemplate.positivePrompt}, featuring ${imgUserPrompt.trim()}, high quality, commercial photography, stunning details`
  }, [selectedImgTemplate, imgUserPrompt])

  // 複製圖片提示詞
  const handleCopyImgPrompt = () => {
    const fullText = `【風格特徵 / 正向提示詞】：\n${previewSynthesizedImgPrompt}\n\n【排除特徵 / 負面提示詞】：\n${selectedImgTemplate.negativePrompt}\n\n【建議尺寸比例】：\n${imgAspectRatio}`
    navigator.clipboard.writeText(fullText)
    setCopiedImgPrompt(true)
    setTimeout(() => setCopiedImgPrompt(false), 2000)
  }

  // 生成圖片
  const handleGenerateImage = async () => {
    setGeneratingImage(true)
    setImgErrorMsg(null)

    try {
      const res = await fetch('/api/marketing/visual-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedImgTemplate.id,
          userPrompt: imgUserPrompt.trim(),
          imageUrl: uploadedImage || undefined,
          aspectRatio: imgAspectRatio,
          model: 'flux',
          action: 'generate_image',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失敗，請稍後再試')

      setGeneratedImgResult({
        url: data.url,
        positivePrompt: data.positivePrompt || previewSynthesizedImgPrompt,
        negativePrompt: data.negativePrompt || selectedImgTemplate.negativePrompt,
        aspectRatio: data.aspectRatio || imgAspectRatio,
      })

      setTimeout(() => {
        const el = document.getElementById('image-generation-result-box')
        el?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err: any) {
      setImgErrorMsg(err.message || '生成失敗')
    } finally {
      setGeneratingImage(false)
    }
  }

  // 複製圖片連結
  const handleCopyImgLink = () => {
    if (!generatedImgResult?.url) return
    navigator.clipboard.writeText(generatedImgResult.url)
    setCopiedImgLink(true)
    setTimeout(() => setCopiedImgLink(false), 2000)
  }

  // ─── 影片分鏡腳本合成 ───────────────────────────────────────────
  const synthesizedVideoScript = useMemo(() => {
    const pName = videoProductName.trim() || '本商品'
    const kPoint = videoKeyPoint.trim() ? `（重點：${videoKeyPoint.trim()}）` : ''

    const lines = [
      `【${selectedVideoTemplate.title} ${selectedVideoTemplate.command} 完整分鏡腳本】`,
      `適用情境：${selectedVideoTemplate.applicability}`,
      `推薦規格：比例 ${videoAspect}｜規格建議：${selectedVideoTemplate.params}`,
      `推廣主題：${pName} ${kPoint}`,
      '',
      '─── 分鏡時間軸規劃 ───',
    ]

    selectedVideoTemplate.scriptTimeline.forEach(item => {
      let content = item.content
      if (videoProductName.trim()) {
        content = content.replace(/產品|成品|招牌飲|商品|這杯/g, pName)
      }
      lines.push(`▶ [${item.time}] ${content}`)
    })

    return lines.join('\n')
  }, [selectedVideoTemplate, videoAspect, videoProductName, videoKeyPoint])

  // 即時計算影片英文 Prompt 骨架
  const synthesizedVideoPrompt = useMemo(() => {
    const pName = videoProductName.trim() ? `${videoProductName.trim()}, ` : ''
    return `commercial advertising video of ${pName}${selectedVideoTemplate.title}, ${selectedVideoTemplate.positivePrompt}, high dynamic range, 4k ultra detailed cinematic lighting, aspect ratio ${videoAspect}`
  }, [selectedVideoTemplate, videoAspect, videoProductName])

  // 複製完整分鏡腳本
  const handleCopyVideoScript = () => {
    navigator.clipboard.writeText(synthesizedVideoScript)
    setCopiedVideoScript(true)
    setTimeout(() => setCopiedVideoScript(false), 2000)
  }

  // 複製影片英文 Prompt
  const handleCopyVideoPrompt = () => {
    navigator.clipboard.writeText(synthesizedVideoPrompt)
    setCopiedVideoPrompt(true)
    setTimeout(() => setCopiedVideoPrompt(false), 2000)
  }

  // AI 智慧擴寫完整口播對白
  const handleExpandAiScript = async () => {
    setExpandingAiScript(true)
    setVideoErrorMsg(null)

    try {
      const prompt = `請為以下行銷影片腳本撰寫專業、具吸引力且自然流暢的口播台詞與分鏡字幕：
模板：${selectedVideoTemplate.title} (${selectedVideoTemplate.command})
適用情境：${selectedVideoTemplate.applicability}
推廣商品/主題：${videoProductName || '精選商品'}
核心特色/優惠：${videoKeyPoint || '極致品質、限時優惠'}
分鏡時間軸結構：
${selectedVideoTemplate.rawScript}

請提供：
1. 吸引人的開場口播（前3秒）
2. 分鏡逐秒台詞與畫面拍攝指令
3. 結尾行動呼籲（CTA）
請用繁體中文回答，口吻具親和力與行銷轉換力。`

      const res = await fetch('/api/marketing/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copyTypes: ['anchor_script'],
          userInstructions: prompt,
          topic: `${selectedVideoTemplate.title} - ${videoProductName || '商品行銷影片'}`,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = data?.copies?.anchor_script || data?.copy || data?.result
        if (text) {
          setExpandedAiScript(text)
        } else {
          setExpandedAiScript(`【${selectedVideoTemplate.title} 口播講稿】\n\n「嗨大家！${videoProductName || '這款人氣好物'}今天正式亮相！${videoKeyPoint ? `不僅${videoKeyPoint}，` : ''}更為您帶來極致超值體驗！現在就留言或點擊主頁連結搶先下單，名額有限送完為止！」`)
        }
      } else {
        setExpandedAiScript(`【${selectedVideoTemplate.title} 口播講稿】\n\n「嗨大家！${videoProductName || '這款人氣好物'}今天正式亮相！${videoKeyPoint ? `不僅${videoKeyPoint}，` : ''}更為您帶來極致超值體驗！現在就留言或點擊主頁連結搶先下單，名額有限送完為止！」`)
      }
    } catch {
      setExpandedAiScript(`【${selectedVideoTemplate.title} 口播講稿】\n\n「嗨大家！${videoProductName || '這款人氣好物'}今天正式亮相！立即點擊了解更多！」`)
    } finally {
      setExpandingAiScript(false)
    }
  }

  // 呼叫 AI 生成影片
  const handleGenerateVideo = async () => {
    setGeneratingVideo(true)
    setVideoErrorMsg(null)
    setVideoResultUrl(null)
    setVideoPollStatus('正在向 AI 影片引擎提交任務...')

    try {
      const res = await fetch('/api/marketing/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: synthesizedVideoPrompt,
          model: 'kling-standard',
          duration: String(Math.min(selectedVideoTemplate.recommendedSeconds, 10)),
          aspectRatio: videoAspect,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error(data.error || '目前方案未開放影片產出，請升級至 TEAM 以上方案')
        }
        throw new Error(data.error || '影片任務提交失敗')
      }

      const requestId = data.requestId
      if (!requestId) {
        throw new Error('未取得影片任務 ID')
      }

      setVideoPollStatus('任務已提交，AI 正在繪製各幀動態與光影渲染 (約 30~60 秒)...')

      // Polling
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 4000))
        setVideoPollStatus(`AI 影片渲染中 (進度 ${Math.min(15 + i * 2, 95)}%)...`)

        try {
          const pollRes = await fetch(`/api/marketing/generate-video?requestId=${requestId}&model=kling-standard`)
          const pollData = await pollRes.json()

          if (pollData.status === 'completed' && pollData.url) {
            setVideoResultUrl(pollData.url)
            setVideoPollStatus(null)
            setGeneratingVideo(false)
            return
          }

          if (pollData.status === 'failed') {
            throw new Error(pollData.error || '影片渲染失敗')
          }
        } catch (pollErr: any) {
          if (pollErr.message && !pollErr.message.includes('fetch')) {
            throw pollErr
          }
        }
      }

      throw new Error('影片生成超時，請稍後至 AI 視覺工坊查看')
    } catch (err: any) {
      setVideoErrorMsg(err.message || '生成失敗')
      setVideoPollStatus(null)
    } finally {
      setGeneratingVideo(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50/60 dark:bg-background">
      {/* 頂部 Header */}
      <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-purple-600 text-white px-6 py-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-200 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="h-4 w-4" />
              <span>行銷視覺風格與廣告創作中心</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              視覺風格與廣告
            </h1>
            <p className="text-amber-100/90 text-sm mt-1 max-w-2xl leading-relaxed">
              免記指令！匯聚 85 種視覺風格呈現與 185 種行銷落地短影音分鏡模板。挑選氛圍感或腳本結構，AI 即刻打造吸睛商用圖文與短影音！
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
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
        {/* 大分頁選擇切換：圖片風格模板 vs 影片廣告腳本 */}
        <div className="bg-card border rounded-2xl p-2 shadow-xs flex items-center gap-2">
          <button
            onClick={() => setMainTab('image')}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl font-bold text-sm transition-all ${
              mainTab === 'image'
                ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            <span>圖片風格模板</span>
            <Badge variant="secondary" className={`text-xs px-2 py-0.5 ${mainTab === 'image' ? 'bg-white/20 text-white border-0' : ''}`}>
              85 款風格
            </Badge>
          </button>

          <button
            onClick={() => setMainTab('video')}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl font-bold text-sm transition-all ${
              mainTab === 'video'
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Video className="h-4 w-4" />
            <span>短影音與廣告腳本</span>
            <Badge variant="secondary" className={`text-xs px-2 py-0.5 ${mainTab === 'video' ? 'bg-white/20 text-white border-0' : ''}`}>
              185 款分鏡
            </Badge>
          </button>
        </div>

        {/* ─── TAB 1: 圖片風格模板 ─────────────────────────────────── */}
        {mainTab === 'image' && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            {/* 搜尋與分類選單 */}
            <div className="bg-card border rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜尋呈現感覺、關鍵字（如：黏土、黑五、免運、折扣、微縮、節慶...）"
                    value={imgSearchQuery}
                    onChange={e => setImgSearchQuery(e.target.value)}
                    className="pl-9 h-10 rounded-xl bg-muted/40 border-muted"
                  />
                  {imgSearchQuery && (
                    <button
                      onClick={() => setImgSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="text-xs text-muted-foreground self-center">
                  共顯示 <b className="text-foreground">{filteredImgTemplates.length}</b> 種視覺呈現風格
                </div>
              </div>

              {/* 分類按鈕列 */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none">
                {IMAGE_CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedImgCat(cat.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      selectedImgCat === cat.key
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 圖片模板列表 + 工作室 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 左側：模板卡片清單 (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[720px] overflow-y-auto pr-1">
                  {filteredImgTemplates.map(tpl => {
                    const isSelected = selectedImgTemplate.id === tpl.id
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleSelectImgTemplate(tpl)}
                        className={`group relative rounded-2xl border p-3 sm:p-3.5 text-left transition-all cursor-pointer bg-card hover:shadow-lg flex flex-col justify-between ${
                          isSelected
                            ? 'ring-2 ring-amber-500 border-amber-500 shadow-md bg-amber-50/20 dark:bg-amber-950/20'
                            : 'hover:border-amber-400/50'
                        }`}
                      >
                        {/* 示範縮圖預覽區 */}
                        <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-muted/30 mb-2.5 border border-border/40 group/thumb">
                          {tpl.previewUrl ? (
                            <img
                              src={tpl.previewUrl}
                              alt={tpl.title}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none'
                              }}
                            />
                          ) : null}
                          {/* 背景漸層兜底 */}
                          <div className={`absolute inset-0 bg-gradient-to-br ${tpl.gradient} opacity-25 -z-10`} />

                          {/* 遮罩漸層與頂部/底部標籤 */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-between p-2 pointer-events-none">
                            <div className="flex items-center justify-between">
                              {tpl.id === 'beforeafter' ? (
                                <Badge className="text-[10px] bg-indigo-600/90 text-white border-0 backdrop-blur-xs font-semibold shadow-xs">
                                  ◀ BEFORE | AFTER ▶
                                </Badge>
                              ) : tpl.badge ? (
                                <Badge variant="outline" className="text-[10px] bg-black/70 text-amber-300 border-amber-400/40 backdrop-blur-xs font-semibold">
                                  {tpl.badge}
                                </Badge>
                              ) : <span />}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPreviewModalTpl(tpl)
                                }}
                                className="pointer-events-auto p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white/90 hover:text-white backdrop-blur-xs transition-all shadow-xs"
                                title="放大檢視示意圖與參數"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="text-[11px] font-medium text-white/95 drop-shadow-sm flex items-center gap-1 truncate">
                              <Sparkles className="h-3 w-3 text-amber-300 shrink-0" />
                              <span className="truncate">{tpl.feeling.split('・')[0]}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5 px-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-sm text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                              {tpl.title}
                            </span>
                          </div>

                          <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 line-clamp-1">
                            {tpl.feeling}
                          </div>

                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            適用：{tpl.applicability}
                          </p>
                        </div>

                        <div className="pt-2.5 mt-2.5 border-t flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
                          <span>預設比例 {tpl.defaultAspect}</span>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                            選擇此風格 →
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 右側：生成設定工作台 (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="p-5 border rounded-2xl shadow-sm space-y-4 sticky top-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                        <span>風格生成設定</span>
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        目前選用：<b className="text-foreground">{selectedImgTemplate.title}</b>
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200">
                      {selectedImgTemplate.badge || '視覺風格'}
                    </Badge>
                  </div>

                  {/* 示範效果預覽卡片 */}
                  <div className="rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-muted/20 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <span>風格示範效果 (Sample Preview)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewModalTpl(selectedImgTemplate)}
                        className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        放大細看
                      </button>
                    </div>

                    <div
                      onClick={() => setPreviewModalTpl(selectedImgTemplate)}
                      className="group/preview relative aspect-video w-full rounded-xl overflow-hidden border border-border/60 bg-muted/40 cursor-pointer shadow-inner"
                    >
                      {selectedImgTemplate.previewUrl ? (
                        <img
                          src={selectedImgTemplate.previewUrl}
                          alt={selectedImgTemplate.title}
                          className="w-full h-full object-cover group-hover/preview:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${selectedImgTemplate.gradient} flex items-center justify-center`}>
                          <Sparkles className="h-8 w-8 text-white/70" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white text-[11px]">
                        <span className="font-medium drop-shadow-sm flex items-center gap-1 truncate mr-2">
                          🎨 {selectedImgTemplate.feeling}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] text-amber-300 shrink-0">
                          點擊放大
                        </span>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-background/70 border text-[11px] text-muted-foreground space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-foreground shrink-0">💡 建議參數：</span>
                        <span className="text-amber-600 dark:text-amber-400 font-medium text-right">{selectedImgTemplate.paramAdvice}</span>
                      </div>
                    </div>
                  </div>

                  {/* 尺寸比例選擇 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">圖片尺寸比例</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {ASPECT_RATIOS.map(ar => (
                        <button
                          key={ar.value}
                          type="button"
                          onClick={() => setImgAspectRatio(ar.value)}
                          className={`p-1.5 rounded-lg border text-center transition-all ${
                            imgAspectRatio === ar.value
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 font-bold'
                              : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                          }`}
                        >
                          <div className="text-[11px]">{ar.value}</div>
                          <div className="text-[9px] truncate opacity-70">{ar.desc.split(' ')[0]}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 商品與賣點描述 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">商品主題 / 促銷賣點說明</label>
                    <Textarea
                      placeholder="例如：手作抹茶千層蛋糕、極簡無線耳機、限量5折免運特惠..."
                      value={imgUserPrompt}
                      onChange={e => setImgUserPrompt(e.target.value)}
                      rows={3}
                      className="text-xs resize-none rounded-xl"
                    />
                  </div>

                  {/* 參考圖片上傳 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span>參考商品照片 (選填，支援圖生圖)</span>
                      {uploadedImage && (
                        <button
                          onClick={() => setUploadedImage(null)}
                          className="text-[10px] text-destructive hover:underline"
                        >
                          移除圖片
                        </button>
                      )}
                    </label>

                    {uploadedImage ? (
                      <div className="relative rounded-xl border p-2 bg-muted/20 flex items-center gap-3">
                        <img src={uploadedImage} alt="Uploaded" className="w-12 h-12 object-cover rounded-lg border" />
                        <div className="text-xs flex-1 truncate">
                          <p className="font-semibold text-foreground">已載入參考照片</p>
                          <p className="text-[10px] text-muted-foreground">AI 將依此形狀與構圖融合風格</p>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => imgFileInputRef.current?.click()}
                        className="border border-dashed border-border/80 rounded-xl p-3 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <Upload className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">點擊上傳商品照片 (JPG / PNG)</p>
                      </div>
                    )}
                    <input ref={imgFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImgFileChange} />
                  </div>

                  {/* 提示詞預覽 */}
                  <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground font-medium">
                      <span>AI Prompt 提示詞骨架</span>
                      <button onClick={handleCopyImgPrompt} className="hover:text-foreground flex items-center gap-1">
                        {copiedImgPrompt ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedImgPrompt ? '已複製' : '複製提示詞'}</span>
                      </button>
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground line-clamp-3 bg-card p-2 rounded border">
                      {previewSynthesizedImgPrompt}
                    </p>
                  </div>

                  {/* 錯誤訊息 */}
                  {imgErrorMsg && (
                    <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                      {imgErrorMsg}
                    </div>
                  )}

                  {/* 生成按鈕 */}
                  <Button
                    onClick={handleGenerateImage}
                    disabled={generatingImage}
                    className="w-full h-10 font-bold bg-gradient-to-r from-amber-600 via-rose-600 to-purple-600 hover:from-amber-700 hover:to-purple-700 text-white shadow-md gap-2"
                  >
                    {generatingImage ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>AI 正在渲染商業行銷圖 (FLUX)...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>立即產生商業行銷圖 (FLUX)</span>
                      </>
                    )}
                  </Button>
                </Card>
              </div>
            </div>

            {/* 圖片生成成果展示 */}
            {generatedImgResult && (
              <div id="image-generation-result-box" className="mt-8 pt-6 border-t space-y-4 animate-in fade-in-50 duration-300">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-foreground">AI 行銷圖產出完成！</h3>
                      <p className="text-xs text-muted-foreground">風格：{selectedImgTemplate.title}（{selectedImgTemplate.feeling}）</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyImgLink} className="h-8 text-xs gap-1.5">
                      {copiedImgLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedImgLink ? '已複製連結' : '複製圖片連結'}
                    </Button>

                    <a href={generatedImgResult.url} download={`marketing-${selectedImgTemplate.id}-${Date.now()}.png`} target="_blank" rel="noreferrer">
                      <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                        <Download className="h-3.5 w-3.5" />
                        下載高畫質大圖
                      </Button>
                    </a>

                    <Button
                      size="sm"
                      onClick={() => setShowImgPublishModal(true)}
                      className="h-8 text-xs gap-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-sm"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      🚀 一鍵串接上傳至社群平台
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-card border rounded-2xl p-5 shadow-sm">
                  <div className="md:col-span-7 flex items-center justify-center bg-black/5 dark:bg-black/40 rounded-xl overflow-hidden p-2 min-h-[360px]">
                    <img src={generatedImgResult.url} alt="Generated Result" className="max-h-[520px] w-auto object-contain rounded-lg shadow-md" />
                  </div>

                  <div className="md:col-span-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 text-xs">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          所採用的完整提示詞骨架
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground leading-relaxed max-h-36 overflow-y-auto bg-card p-2 rounded border">
                          {generatedImgResult.positivePrompt}
                        </p>
                      </div>

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
                          免手動下載轉存！立即將這張成果圖同步發布至 Facebook、Instagram、Threads、LINE 等社群平台。
                        </p>
                        <Button
                          size="sm"
                          className="w-full h-8 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                          onClick={() => setShowImgPublishModal(true)}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          開啟上傳中心並選擇發布平台
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t">
                      <Button variant="outline" className="w-full text-xs font-semibold gap-1.5" onClick={handleGenerateImage} disabled={generatingImage}>
                        <RefreshCw className={`h-3.5 w-3.5 ${generatingImage ? 'animate-spin' : ''}`} />
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
        )}

        {/* ─── TAB 2: 影片廣告腳本 ─────────────────────────────────── */}
        {mainTab === 'video' && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            {/* 搜尋與分類選單 */}
            <div className="bg-card border rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜尋指令或主題（如：/hook3sec、痛點、360、開箱、ASMR、黑五、對比...）"
                    value={videoSearchQuery}
                    onChange={e => setVideoSearchQuery(e.target.value)}
                    className="pl-9 h-10 rounded-xl bg-muted/40 border-muted"
                  />
                  {videoSearchQuery && (
                    <button
                      onClick={() => setVideoSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="text-xs text-muted-foreground self-center">
                  共顯示 <b className="text-foreground">{filteredVideoTemplates.length}</b> 種行銷分鏡模板
                </div>
              </div>

              {/* 分類按鈕列 */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none">
                {VIDEO_CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedVideoCat(cat.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      selectedVideoCat === cat.key
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 影片模板列表 + 工作室 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 左側：影片模板清單 (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[760px] overflow-y-auto pr-1">
                  {filteredVideoTemplates.map(tpl => {
                    const isSelected = selectedVideoTemplate.id === tpl.id
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleSelectVideoTemplate(tpl)}
                        className={`group relative rounded-2xl border p-4 text-left transition-all cursor-pointer bg-card hover:shadow-md flex flex-col justify-between ${
                          isSelected
                            ? 'ring-2 ring-blue-500 border-blue-500 shadow-md bg-blue-50/20 dark:bg-blue-950/20'
                            : 'hover:border-border/80'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                              {tpl.command}
                            </span>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border">
                                {tpl.defaultAspect}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">
                                {tpl.recommendedSeconds}s
                              </Badge>
                            </div>
                          </div>

                          <div className="font-bold text-sm text-foreground">
                            {tpl.title}
                          </div>

                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            適用：{tpl.applicability}
                          </p>
                        </div>

                        <div className="pt-3 mt-3 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="truncate max-w-[130px]">{tpl.scriptTimeline.length} 個分鏡鏡頭</span>
                          <span className="text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                            套用腳本 →
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 右側：影片分鏡與製作工作台 (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="p-5 border rounded-2xl shadow-sm space-y-4 sticky top-4 max-h-[85vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded">
                          {selectedVideoTemplate.command}
                        </span>
                        <h2 className="font-bold text-base text-foreground">
                          {selectedVideoTemplate.title}
                        </h2>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedVideoTemplate.applicability}
                      </p>
                    </div>
                  </div>

                  {/* 分鏡時間軸視覺化 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-blue-600" />
                        官方分鏡腳本結構
                      </span>
                      <span className="text-[11px] text-muted-foreground font-normal">
                        建議長度：約 {selectedVideoTemplate.recommendedSeconds} 秒
                      </span>
                    </div>

                    <div className="bg-muted/40 border rounded-xl p-3 space-y-2 text-xs">
                      {selectedVideoTemplate.scriptTimeline.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2.5">
                          <span className="font-mono font-bold text-[11px] text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded shrink-0">
                            {item.time}
                          </span>
                          <span className="text-[11px] text-foreground leading-relaxed">
                            {item.content}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      💡 規格參數建議：{selectedVideoTemplate.params}
                    </p>
                  </div>

                  {/* 自訂商品與賣點 */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground">商品 / 主題名稱</label>
                      <Input
                        placeholder="例如：招牌黑糖厚奶、極簡降噪耳機、周年慶限定禮盒..."
                        value={videoProductName}
                        onChange={e => setVideoProductName(e.target.value)}
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground">核心亮點 / 促銷說明 (選填)</label>
                      <Input
                        placeholder="例如：3層濃郁口感、客人回購率90%、限時買一送一..."
                        value={videoKeyPoint}
                        onChange={e => setVideoKeyPoint(e.target.value)}
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>

                    {/* 影片比例 */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground">影片長寬比例</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['9:16', '16:9', '1:1', '4:5'] as const).map(ratio => (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => setVideoAspect(ratio)}
                            className={`py-1.5 px-2 rounded-lg border text-center text-xs transition-all ${
                              videoAspect === ratio
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 font-bold'
                                : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                            }`}
                          >
                            {ratio}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 即時組裝提示詞與腳本工具 */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyVideoScript}
                        className="text-xs h-7 gap-1 font-semibold"
                      >
                        {copiedVideoScript ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedVideoScript ? '已複製腳本' : '複製完整分鏡腳本'}</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyVideoPrompt}
                        className="text-xs h-7 gap-1 font-semibold"
                      >
                        {copiedVideoPrompt ? <Check className="h-3 w-3 text-emerald-600" /> : <FileText className="h-3 w-3" />}
                        <span>{copiedVideoPrompt ? '已複製Prompt' : '複製英文Prompt'}</span>
                      </Button>
                    </div>

                    {/* AI 智慧擴寫完整口播對白 */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleExpandAiScript}
                      disabled={expandingAiScript}
                      className="w-full text-xs h-8 gap-1.5 font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                    >
                      {expandingAiScript ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>✨ AI 智慧擴寫完整逐字口播台詞與分鏡指示</span>
                    </Button>

                    {expandedAiScript && (
                      <div className="p-3 bg-muted/40 rounded-xl space-y-1 text-xs border animate-in fade-in-50">
                        <div className="font-bold text-foreground flex items-center justify-between">
                          <span>AI 逐字口播講稿建議</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(expandedAiScript)
                              alert('已複製口播台詞')
                            }}
                            className="text-[10px] text-primary hover:underline"
                          >
                            複製講稿
                          </button>
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                          {expandedAiScript}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 錯誤訊息 */}
                  {videoErrorMsg && (
                    <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                      {videoErrorMsg}
                    </div>
                  )}

                  {/* 產生中狀態提示 */}
                  {videoPollStatus && (
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span>{videoPollStatus}</span>
                    </div>
                  )}

                  {/* 影片產出播放器與社群直發按鈕 */}
                  {videoResultUrl && (
                    <div className="space-y-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-in fade-in-50">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          AI 短影音生成完成！
                        </span>
                        <a href={videoResultUrl} download={`video-${selectedVideoTemplate.id}.mp4`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1">
                            <Download className="h-3 w-3" />
                            下載影片
                          </Button>
                        </a>
                      </div>

                      <div className="rounded-lg overflow-hidden bg-black flex items-center justify-center">
                        <video src={videoResultUrl} controls className="max-h-[220px] w-auto" />
                      </div>

                      <Button
                        size="sm"
                        onClick={() => setShowVideoPublishModal(true)}
                        className="w-full h-8 text-xs font-bold gap-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-sm"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        🚀 一鍵串接上傳至社群短影音 (Reels / Shorts / TikTok)
                      </Button>
                    </div>
                  )}

                  {/* 執行生成按鈕 */}
                  <Button
                    onClick={handleGenerateVideo}
                    disabled={generatingVideo}
                    className="w-full h-10 font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md gap-2"
                  >
                    {generatingVideo ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>AI 影片引擎運算中...</span>
                      </>
                    ) : (
                      <>
                        <Film className="h-4 w-4" />
                        <span>呼叫 AI 影片引擎生成 (Kling/Haiper)</span>
                      </>
                    )}
                  </Button>

                  <div className="pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowVideoPublishModal(true)}
                      className="w-full text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    >
                      <Share2 className="h-3.5 w-3.5 text-blue-600" />
                      已有影片檔案？直接開啟上傳中心同步發布 →
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── 風格示意圖放大 Lightbox 彈窗 ───────────────────────────────── */}
      {previewModalTpl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewModalTpl(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-card border rounded-3xl overflow-hidden shadow-2xl space-y-0"
            onClick={e => e.stopPropagation()}
          >
            {/* 標題列 */}
            <div className="p-4 sm:px-6 flex items-center justify-between border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs">
                  {previewModalTpl.badge || '視覺風格示意'}
                </Badge>
                <h3 className="font-bold text-base sm:text-lg text-foreground">
                  {previewModalTpl.title}
                </h3>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  （{previewModalTpl.feeling}）
                </span>
              </div>
              <button
                onClick={() => setPreviewModalTpl(null)}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 圖片展示區 */}
            <div className="relative aspect-[16/10] sm:aspect-video w-full bg-black/95 flex items-center justify-center overflow-hidden">
              {previewModalTpl.previewUrl ? (
                <img
                  src={previewModalTpl.previewUrl}
                  alt={previewModalTpl.title}
                  className="w-full h-full object-cover sm:object-contain"
                />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${previewModalTpl.gradient} flex items-center justify-center`}>
                  <Sparkles className="h-12 w-12 text-white/70" />
                </div>
              )}
            </div>

            {/* 參數與說明 */}
            <div className="p-5 sm:p-6 space-y-4 bg-card">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
                  <span className="font-bold text-foreground">✨ 風格氛圍感知</span>
                  <p className="text-amber-600 dark:text-amber-400 font-medium">{previewModalTpl.feeling}</p>
                  <p className="text-muted-foreground text-[11px] mt-1">適用：{previewModalTpl.applicability}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
                  <span className="font-bold text-foreground">⚙️ 最佳生成建議</span>
                  <p className="text-foreground">{previewModalTpl.paramAdvice}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {previewModalTpl.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border font-mono text-[11px] text-muted-foreground break-all">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">提示詞骨架 (Positive Prompt)</div>
                {previewModalTpl.positivePrompt}
              </div>

              {/* 按鈕動作 */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setPreviewModalTpl(null)}
                >
                  關閉
                </Button>
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                  onClick={() => {
                    handleSelectImgTemplate(previewModalTpl)
                    setPreviewModalTpl(null)
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  套用此風格並設定生成
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 圖片社群平台發布 Modal */}
      {generatedImgResult && (
        <SocialPublishModal
          open={showImgPublishModal}
          onClose={() => setShowImgPublishModal(false)}
          media={{
            type: 'image',
            url: generatedImgResult.url,
            title: `${selectedImgTemplate.title}（${selectedImgTemplate.feeling}）`,
            aspectRatio: generatedImgResult.aspectRatio,
          }}
          initialCopy={`✨【${selectedImgTemplate.title}】新視覺公開！\n\n以「${selectedImgTemplate.feeling}」專屬風格打造，呈現極致質感與細節魅力 🔥${imgUserPrompt.trim() ? `\n\n重點特色：${imgUserPrompt.trim()}` : ''}\n\n立即了解更多或私訊我們！\n\n#品牌視覺 #新品上市 #行銷設計 #社群亮點 #質感生活`}
          sourceName={`視覺風格與廣告 (${selectedImgTemplate.title})`}
        />
      )}

      {/* 影片社群平台發布 Modal */}
      <SocialPublishModal
        open={showVideoPublishModal}
        onClose={() => setShowVideoPublishModal(false)}
        media={{
          type: 'video',
          url: videoResultUrl || 'https://assets.mixkit.co/videos/preview/mixkit-vertical-video-of-a-latte-with-art-40810-large.mp4',
          title: `${selectedVideoTemplate.title}（${selectedVideoTemplate.command}）`,
          aspectRatio: videoAspect,
        }}
        initialCopy={
          expandedAiScript ||
          `🔥【${selectedVideoTemplate.title}】短影音重磅登場！\n\n${videoProductName ? `產品：${videoProductName}\n` : ''}${videoKeyPoint ? `亮點：${videoKeyPoint}\n\n` : ''}以專業短影音分鏡打造高停留與高轉化視覺，立即觀看完整亮點！\n\n#短影音 #Reels #Shorts #TikTok #品牌行銷`
        }
        sourceName={`視覺風格與廣告 - 影片分鏡 (${selectedVideoTemplate.command})`}
      />
    </div>
  )
}
