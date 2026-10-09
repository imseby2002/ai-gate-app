'use client'

import React, { useState, useMemo, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
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
import { useDataDict } from '@/lib/i18n-data/useDataDict'
import { localizeVisual, localizeVideo } from '@/lib/i18n-data/localize-templates'

const ASPECT_RATIOS: { value: '1:1' | '4:5' | '3:4' | '16:9' | '9:16'; label: string; desc: string }[] = [
  // desc 為 MktTemplates.ar.* 的 key
  { value: '1:1',  label: '1:1',  desc: 'ar11' },
  { value: '4:5',  label: '4:5',  desc: 'ar45' },
  { value: '3:4',  label: '3:4',  desc: 'ar34' },
  { value: '16:9', label: '16:9', desc: 'ar169' },
  { value: '9:16', label: '9:16', desc: 'ar916' },
]

export default function VisualTemplatesPage() {
  const t = useTranslations('MktTemplates')
  const tr = useDataDict('templates')
  const imgTemplates = useMemo(() => VISUAL_TEMPLATES.map(x => localizeVisual(x, tr)), [tr])
  const videoTemplates = useMemo(() => VIDEO_TEMPLATES.map(x => localizeVideo(x, tr)), [tr])
  const locale = useLocale()
  const answerLang = locale === 'vi' ? 'tiếng Việt' : locale === 'en' ? 'English' : '繁體中文'
  // 主分頁切換：'image' (圖片風格模板) 或 'video' (影片廣告腳本)
  const [mainTab, setMainTab] = useState<'image' | 'video'>('image')

  // ─── 圖片模式狀態 ───────────────────────────────────────────────
  const [selectedImgCat, setSelectedImgCat] = useState<ImageTemplateCategory>('all')
  const [imgSearchQuery, setImgSearchQuery] = useState('')
  const [selectedImgTemplateRaw, setSelectedImgTemplate] = useState<VisualTemplate>(VISUAL_TEMPLATES[0])
  const selectedImgTemplate = imgTemplates.find(x => x.id === selectedImgTemplateRaw.id) ?? selectedImgTemplateRaw
  const [imgAspectRatio, setImgAspectRatio] = useState<'1:1' | '4:5' | '3:4' | '16:9' | '9:16'>(VISUAL_TEMPLATES[0].defaultAspect)

  const [imgUserPrompt, setImgUserPrompt] = useState('')
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  // 文字生圖引擎（實測切換）：有參考圖時一律走 Nano Banana Pro
  const [imgEngine, setImgEngine] = useState<'flux' | 'ideogram'>('flux')
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
  const [previewModalTplRaw, setPreviewModalTpl] = useState<VisualTemplate | null>(null)
  const previewModalTpl = previewModalTplRaw && (imgTemplates.find(x => x.id === previewModalTplRaw.id) ?? previewModalTplRaw)

  // ─── 影片模式狀態 ───────────────────────────────────────────────
  const [selectedVideoCat, setSelectedVideoCat] = useState<VideoCategory>('all')
  const [videoSearchQuery, setVideoSearchQuery] = useState('')
  const [selectedVideoTemplateRaw, setSelectedVideoTemplate] = useState<VideoTemplate>(VIDEO_TEMPLATES[0])
  const selectedVideoTemplate = videoTemplates.find(x => x.id === selectedVideoTemplateRaw.id) ?? selectedVideoTemplateRaw
  const [videoAspect, setVideoAspect] = useState<'9:16' | '16:9' | '1:1' | '4:5'>(VIDEO_TEMPLATES[0].defaultAspect)
  const [videoProductName, setVideoProductName] = useState('')
  const [videoKeyPoint, setVideoKeyPoint] = useState('')
  const [videoRefImage, setVideoRefImage] = useState<string | null>(null)
  const videoFileInputRef = useRef<HTMLInputElement>(null)
  
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
    return imgTemplates.filter(t => {
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
  }, [imgTemplates, selectedImgCat, imgSearchQuery])

  // ─── 影片篩選 ───────────────────────────────────────────────────
  const filteredVideoTemplates = useMemo(() => {
    return videoTemplates.filter(t => {
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
  }, [videoTemplates, selectedVideoCat, videoSearchQuery])

  // 選擇圖片模板
  const handleSelectImgTemplate = (tpl: VisualTemplate) => {
    setSelectedImgTemplate(tpl)
    setImgAspectRatio(tpl.defaultAspect)
    setUploadedImages(prev => prev.slice(0, tpl.maxReferenceImages ?? 1))
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
    const maxRefs = selectedImgTemplate.maxReferenceImages ?? 1
    const files = Array.from(e.target.files ?? []).slice(0, Math.max(1, maxRefs - (maxRefs > 1 ? uploadedImages.length : 0)))
    e.target.value = ''
    if (!files.length) return

    if (files.some(f => !f.type.startsWith('image/'))) {
      alert(t('badFormat'))
      return
    }

    // 單圖模板直接取代；多圖模板累加至上限
    const addImage = (dataUrl: string) => setUploadedImages(prev => (maxRefs > 1 ? [...prev, dataUrl] : [dataUrl]).slice(0, maxRefs))
    // 多圖時壓小一點，避免總請求超過 Vercel 4.5MB 上限
    const MAX = maxRefs > 1 ? 1024 : 1536

    setUploadingImage(true)
    let pending = files.length
    const done = () => { pending -= 1; if (pending <= 0) setUploadingImage(false) }
    for (const file of files) {
      const reader = new FileReader()
      reader.onload = ev => {
        // 手機原圖 base64 常超過 Vercel 4.5MB 請求上限（回傳純文字 Request Entity Too Large），先縮圖壓成 JPEG
        const src = ev.target?.result as string
        const img = new window.Image()
        img.onload = () => {
          const scale = Math.min(1, MAX / Math.max(img.width, img.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(img.width * scale)
          canvas.height = Math.round(img.height * scale)
          const ctx = canvas.getContext('2d')
          if (!ctx) { addImage(src); done(); return }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          addImage(canvas.toDataURL('image/jpeg', 0.85))
          done()
        }
        img.onerror = () => { addImage(src); done() }
        img.src = src
      }
      reader.readAsDataURL(file)
    }
  }

  // 影片參考圖上傳（圖生影片，縮圖壓成 JPEG 避免超過 Vercel 4.5MB 請求上限）
  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert(t('badFormat'))
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      const src = ev.target?.result as string
      const img = new window.Image()
      img.onload = () => {
        const MAX = 1536
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) { setVideoRefImage(src); return }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        setVideoRefImage(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => setVideoRefImage(src)
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  const engineLabel = !uploadedImages.length && imgEngine === 'ideogram' ? 'Ideogram v3' : 'Nano Banana Pro'

  // 即時計算圖片提示詞
  const previewSynthesizedImgPrompt = useMemo(() => {
    if (!imgUserPrompt.trim()) return selectedImgTemplate.positivePrompt
    return `${imgUserPrompt.trim()}, ${selectedImgTemplate.positivePrompt}, high quality, commercial photography, stunning details`
  }, [selectedImgTemplate, imgUserPrompt])

  // 複製圖片提示詞
  const handleCopyImgPrompt = () => {
    const fullText = `${t('fullPos')}\n${previewSynthesizedImgPrompt}\n\n${t('fullNeg')}\n${selectedImgTemplate.negativePrompt}\n\n${t('fullAspect')}\n${imgAspectRatio}`
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
          imageUrls: uploadedImages.length ? uploadedImages : undefined,
          aspectRatio: imgAspectRatio,
          model: uploadedImages.length ? 'flux' : imgEngine,
          action: 'generate_image',
        }),
      })

      const raw = await res.text()
      let data: any = {}
      try { data = JSON.parse(raw) } catch {
        throw new Error(res.status === 413 ? t('tooLarge') : t('genFailedRetry'))
      }
      if (!res.ok) throw new Error(data.error || t('genFailedRetry'))

      setGeneratedImgResult({
        url: data.url,
        positivePrompt: data.revisedPrompt || data.positivePrompt || previewSynthesizedImgPrompt,
        negativePrompt: data.negativePrompt || selectedImgTemplate.negativePrompt,
        aspectRatio: data.aspectRatio || imgAspectRatio,
      })

      setTimeout(() => {
        const el = document.getElementById('image-generation-result-box')
        el?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err: any) {
      setImgErrorMsg(err.message || t('genFailed'))
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
    const pName = videoProductName.trim() || t('thisProduct')
    const kPoint = videoKeyPoint.trim() ? t('keyPointParen', { k: videoKeyPoint.trim() }) : ''

    const lines = [
      t('scriptTitle', { title: selectedVideoTemplate.title, cmd: selectedVideoTemplate.command }),
      `${t('applicability')}${selectedVideoTemplate.applicability}`,
      t('specLine', { aspect: videoAspect, params: selectedVideoTemplate.params }),
      `${t('topicLine')}${pName} ${kPoint}`,
      '',
      t('timelineHead'),
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
推廣商品/主題：${videoProductName || t('featuredProduct')}
核心特色/優惠：${videoKeyPoint || t('defaultKeyPoint')}
分鏡時間軸結構：
${selectedVideoTemplate.rawScript}

請提供：
1. 吸引人的開場口播（前3秒）
2. 分鏡逐秒台詞與畫面拍攝指令
3. 結尾行動呼籲（CTA）
請用${answerLang}回答，口吻具親和力與行銷轉換力。`

      const res = await fetch('/api/marketing/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copyTypes: ['anchor_script'],
          userInstructions: prompt,
          topic: `${selectedVideoTemplate.title} - ${videoProductName || t('productVideo')}`,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = data?.copies?.anchor_script || data?.copy || data?.result
        if (text) {
          setExpandedAiScript(text)
        } else {
          setExpandedAiScript(t('fallbackScript', { title: selectedVideoTemplate.title, name: videoProductName || t('popularItem'), kp: videoKeyPoint ? t('fallbackKp', { k: videoKeyPoint }) : '' }))
        }
      } else {
        setExpandedAiScript(t('fallbackScript', { title: selectedVideoTemplate.title, name: videoProductName || t('popularItem'), kp: videoKeyPoint ? t('fallbackKp', { k: videoKeyPoint }) : '' }))
      }
    } catch {
      setExpandedAiScript(t('fallbackShort', { title: selectedVideoTemplate.title, name: videoProductName || t('popularItem') }))
    } finally {
      setExpandingAiScript(false)
    }
  }

  // 呼叫 AI 生成影片
  const handleGenerateVideo = async () => {
    setGeneratingVideo(true)
    setVideoErrorMsg(null)
    setVideoResultUrl(null)
    setVideoPollStatus(t('pollSubmitting'))
    // 有參考圖走圖生影片
    const videoModel = videoRefImage ? 'kling-img2video' : 'kling-standard'

    try {
      const res = await fetch('/api/marketing/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: synthesizedVideoPrompt,
          model: videoModel,
          duration: String(Math.min(selectedVideoTemplate.recommendedSeconds, 10)),
          aspectRatio: videoAspect,
          imageUrl: videoRefImage || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error(data.error || t('needPro'))
        }
        throw new Error(data.error || t('submitFailed'))
      }

      const requestId = data.requestId
      if (!requestId) {
        throw new Error(t('noTaskId'))
      }

      setVideoPollStatus(t('pollSubmitted'))

      // Polling
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 4000))
        setVideoPollStatus(t('pollProgress', { p: Math.min(15 + i * 2, 95) }))

        try {
          const pollRes = await fetch(`/api/marketing/generate-video?requestId=${requestId}&model=${videoModel}`)
          const pollData = await pollRes.json()

          if (pollData.status === 'completed' && pollData.url) {
            setVideoResultUrl(pollData.url)
            setVideoPollStatus(null)
            setGeneratingVideo(false)
            return
          }

          if (pollData.status === 'failed') {
            throw new Error(pollData.error || t('renderFailed'))
          }
        } catch (pollErr: any) {
          if (pollErr.message && !pollErr.message.includes('fetch')) {
            throw pollErr
          }
        }
      }

      throw new Error(t('timeout'))
    } catch (err: any) {
      setVideoErrorMsg(err.message || t('genFailed'))
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
              <span>{t('hubTag')}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {t('title')}
            </h1>
            <p className="text-amber-100/90 text-sm mt-1 max-w-2xl leading-relaxed">
              {t('subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <Link href="/marketing/ai-studio">
              <Button variant="secondary" size="sm" className="gap-1.5 bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-xs font-semibold">
                <Sliders className="h-4 w-4" />
                {t('openStudio')}
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
            <span>{t('tabImage')}</span>
            <Badge variant="secondary" className={`text-xs px-2 py-0.5 ${mainTab === 'image' ? 'bg-white/20 text-white border-0' : ''}`}>
              {t('count85')}
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
            <span>{t('tabVideo')}</span>
            <Badge variant="secondary" className={`text-xs px-2 py-0.5 ${mainTab === 'video' ? 'bg-white/20 text-white border-0' : ''}`}>
              {t('count185')}
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
                    placeholder={t('searchImgPh')}
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
                  {t.rich('imgCount', { n: filteredImgTemplates.length, b: c => <b className="text-foreground">{c}</b> })}
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
                    <span>{t(`cat.${cat.key}`)}</span>
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
                                title={t('zoomTitle')}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="text-[11px] font-medium text-white/95 drop-shadow-sm flex items-center gap-1 truncate">
                              <Sparkles className="h-3 w-3 text-amber-300 shrink-0" />
                              <span className="truncate">{tpl.feeling.split(/[・·]/)[0].trim()}</span>
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
                            {t('fitFor')}{tpl.applicability}
                          </p>
                        </div>

                        <div className="pt-2.5 mt-2.5 border-t flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
                          <span>{t('defaultAspect', { a: tpl.defaultAspect })}</span>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                            {t('chooseStyle')}
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
                        <span>{t('genSettings')}</span>
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('currentStyle')}<b className="text-foreground">{selectedImgTemplate.title}</b>
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200">
                      {selectedImgTemplate.badge || t('visualStyle')}
                    </Badge>
                  </div>

                  {/* 示範效果預覽卡片 */}
                  <div className="rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-muted/20 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <span>{t('samplePreview')}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewModalTpl(selectedImgTemplate)}
                        className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {t('zoomIn')}
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
                          {t('clickZoom')}
                        </span>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-background/70 border text-[11px] text-muted-foreground space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-foreground shrink-0">💡 {t('suggestedParams')}</span>
                        <span className="text-amber-600 dark:text-amber-400 font-medium text-right">{selectedImgTemplate.paramAdvice}</span>
                      </div>
                    </div>
                  </div>

                  {/* 尺寸比例選擇 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{t('imgAspect')}</label>
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
                          <div className="text-[9px] truncate opacity-70">{t(`ar.${ar.desc}`).split(' / ')[0]}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 商品與賣點描述 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{t('imgTopic')}</label>
                    <Textarea
                      placeholder={t('imgTopicPh')}
                      value={imgUserPrompt}
                      onChange={e => setImgUserPrompt(e.target.value)}
                      rows={3}
                      className="text-xs resize-none rounded-xl"
                    />
                  </div>

                  {/* 參考圖片上傳 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span>
                        {t('refPhotos')}{(selectedImgTemplate.maxReferenceImages ?? 1) > 1 ? t('refMax', { n: selectedImgTemplate.maxReferenceImages ?? 1 }) : ''}{t('refClose')}
                      </span>
                      {uploadedImages.length > 0 && (
                        <button
                          onClick={() => setUploadedImages([])}
                          className="text-[10px] text-destructive hover:underline"
                        >
                          {t('removeImage')}
                        </button>
                      )}
                    </label>

                    {uploadedImages.length > 0 && (
                      <div className="relative rounded-xl border p-2 bg-muted/20 flex items-center gap-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {uploadedImages.map((src, i) => (
                            <div key={i} className="relative">
                              <img src={src} alt={`Uploaded ${i + 1}`} className="w-12 h-12 object-cover rounded-lg border" />
                              {uploadedImages.length > 1 && (
                                <button
                                  onClick={() => setUploadedImages(prev => prev.filter((_, idx) => idx !== i))}
                                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-white text-[10px] leading-none"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="text-xs flex-1 truncate">
                          <p className="font-semibold text-foreground">{t('loadedN', { n: uploadedImages.length })}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {uploadedImages.length > 1 ? t('multiRefNote') : t('singleRefNote')}
                          </p>
                        </div>
                      </div>
                    )}
                    {uploadedImages.length < (selectedImgTemplate.maxReferenceImages ?? 1) && (
                      <div
                        onClick={() => imgFileInputRef.current?.click()}
                        className="border border-dashed border-border/80 rounded-xl p-3 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <Upload className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">
                          {uploadedImages.length > 0 ? t('addMorePhotos') : t('uploadPhotos')}
                        </p>
                      </div>
                    )}
                    <input
                      ref={imgFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple={(selectedImgTemplate.maxReferenceImages ?? 1) > 1}
                      className="hidden"
                      onChange={handleImgFileChange}
                    />
                  </div>

                  {/* 提示詞預覽 */}
                  <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground font-medium">
                      <span>{t('promptSkeleton')}</span>
                      <button onClick={handleCopyImgPrompt} className="hover:text-foreground flex items-center gap-1">
                        {copiedImgPrompt ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedImgPrompt ? t('copied') : t('copyPrompt')}</span>
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

                  {/* 生成引擎（實測切換） */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">{t('engine')}</label>
                    {uploadedImages.length ? (
                      <p className="text-[11px] text-muted-foreground">{t('engineFixed')}</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {([
                          { id: 'flux', name: 'Nano Banana Pro', hint: t('perImage', { p: '$0.20' }) },
                          { id: 'ideogram', name: 'Ideogram v3', hint: t('perImageTested', { p: '$0.18' }) },
                        ] as const).map(e => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => setImgEngine(e.id)}
                            className={`rounded-lg border px-2 py-1.5 text-xs text-left transition-colors ${imgEngine === e.id ? 'border-primary bg-primary/5 font-semibold' : 'hover:bg-muted/40'}`}
                          >
                            <div>{e.name}</div>
                            <div className="text-[10px] text-muted-foreground">{e.hint}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 生成按鈕 */}
                  <Button
                    onClick={handleGenerateImage}
                    disabled={generatingImage}
                    className="w-full h-10 font-bold bg-gradient-to-r from-amber-600 via-rose-600 to-purple-600 hover:from-amber-700 hover:to-purple-700 text-white shadow-md gap-2"
                  >
                    {generatingImage ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{t('rendering', { e: engineLabel })}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>{t('generateNow', { e: engineLabel })}</span>
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
                      <h3 className="font-bold text-lg text-foreground">{t('imgDone')}</h3>
                      <p className="text-xs text-muted-foreground">{t('styleLine', { title: selectedImgTemplate.title, feeling: selectedImgTemplate.feeling })}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyImgLink} className="h-8 text-xs gap-1.5">
                      {copiedImgLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedImgLink ? t('linkCopied') : t('copyImgLink')}
                    </Button>

                    <a href={generatedImgResult.url} download={`marketing-${selectedImgTemplate.id}-${Date.now()}.png`} target="_blank" rel="noreferrer">
                      <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                        <Download className="h-3.5 w-3.5" />
                        {t('downloadHd')}
                      </Button>
                    </a>

                    <Button
                      size="sm"
                      onClick={() => setShowImgPublishModal(true)}
                      className="h-8 text-xs gap-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-sm"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      🚀 {t('publishSocial')}
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
                          {t('fullSkeleton')}
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground leading-relaxed max-h-36 overflow-y-auto bg-card p-2 rounded border">
                          {generatedImgResult.positivePrompt}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-xs flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                            <Share2 className="h-3.5 w-3.5" />
                            {t('publishHub')}
                          </div>
                          <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-300">
                            {t('multiPlatform')}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {t('publishDesc')}
                        </p>
                        <Button
                          size="sm"
                          className="w-full h-8 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                          onClick={() => setShowImgPublishModal(true)}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          {t('openPublish')}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t">
                      <Button variant="outline" className="w-full text-xs font-semibold gap-1.5" onClick={handleGenerateImage} disabled={generatingImage}>
                        <RefreshCw className={`h-3.5 w-3.5 ${generatingImage ? 'animate-spin' : ''}`} />
                        {t('regenerate')}
                      </Button>
                      <Link href="/marketing/ai-studio">
                        <Button variant="ghost" className="w-full text-xs text-primary gap-1">
                          {t('toStudio')}
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
                    placeholder={t('searchVideoPh')}
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
                  {t.rich('videoCount', { n: filteredVideoTemplates.length, b: c => <b className="text-foreground">{c}</b> })}
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
                    <span>{t(`vcat.${cat.key}`)}</span>
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
                            {t('fitFor')}{tpl.applicability}
                          </p>
                        </div>

                        <div className="pt-3 mt-3 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="truncate max-w-[130px]">{t('shots', { n: tpl.scriptTimeline.length })}</span>
                          <span className="text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                            {t('useScript')}
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
                        {t('officialStructure')}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-normal">
                        {t('suggestedLength', { s: selectedVideoTemplate.recommendedSeconds })}
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
                      💡 {t('specSuggest')}{selectedVideoTemplate.params}
                    </p>
                  </div>

                  {/* 自訂商品與賣點 */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground">{t('videoName')}</label>
                      <Input
                        placeholder={t('videoNamePh')}
                        value={videoProductName}
                        onChange={e => setVideoProductName(e.target.value)}
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground">{t('videoKey')}</label>
                      <Input
                        placeholder={t('videoKeyPh')}
                        value={videoKeyPoint}
                        onChange={e => setVideoKeyPoint(e.target.value)}
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>

                    {/* 參考圖片（圖生影片） */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground flex items-center justify-between">
                        <span>{t('videoRef')}</span>
                        {videoRefImage && (
                          <button
                            type="button"
                            onClick={() => setVideoRefImage(null)}
                            className="text-[10px] text-destructive hover:underline"
                          >
                            {t('removeImage')}
                          </button>
                        )}
                      </label>
                      {videoRefImage ? (
                        <div className="rounded-lg border p-2 bg-muted/20 flex items-center gap-3">
                          <img src={videoRefImage} alt="Video reference" className="w-12 h-12 object-cover rounded-lg border" />
                          <div className="text-xs flex-1 truncate">
                            <p className="font-semibold text-foreground">{t('refLoaded')}</p>
                            <p className="text-[10px] text-muted-foreground">{t('refFirstFrame')}</p>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => videoFileInputRef.current?.click()}
                          className="border border-dashed border-border/80 rounded-lg p-2.5 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                        >
                          <Upload className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                          <p className="text-xs text-muted-foreground">{t('uploadScene')}</p>
                        </div>
                      )}
                      <input ref={videoFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleVideoFileChange} />
                    </div>

                    {/* 影片比例 */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground">{t('videoAspect')}</label>
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
                        <span>{copiedVideoScript ? t('scriptCopied') : t('copyScript')}</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyVideoPrompt}
                        className="text-xs h-7 gap-1 font-semibold"
                      >
                        {copiedVideoPrompt ? <Check className="h-3 w-3 text-emerald-600" /> : <FileText className="h-3 w-3" />}
                        <span>{copiedVideoPrompt ? t('promptCopied') : t('copyEnPrompt')}</span>
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
                      <span>✨ {t('expandScript')}</span>
                    </Button>

                    {expandedAiScript && (
                      <div className="p-3 bg-muted/40 rounded-xl space-y-1 text-xs border animate-in fade-in-50">
                        <div className="font-bold text-foreground flex items-center justify-between">
                          <span>{t('voScript')}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(expandedAiScript)
                              alert(t('voCopied'))
                            }}
                            className="text-[10px] text-primary hover:underline"
                          >
                            {t('copyVo')}
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
                          {t('videoDone')}
                        </span>
                        <a href={videoResultUrl} download={`video-${selectedVideoTemplate.id}.mp4`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1">
                            <Download className="h-3 w-3" />
                            {t('downloadVideo')}
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
                        🚀 {t('publishVideo')}
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
                        <span>{t('videoBusy')}</span>
                      </>
                    ) : (
                      <>
                        <Film className="h-4 w-4" />
                        <span>{t('videoGen')}</span>
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
                      {t('haveVideo')}
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
                  {previewModalTpl.badge || t('styleSample')}
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
                  <span className="font-bold text-foreground">✨ {t('styleMood')}</span>
                  <p className="text-amber-600 dark:text-amber-400 font-medium">{previewModalTpl.feeling}</p>
                  <p className="text-muted-foreground text-[11px] mt-1">{t('fitFor')}{previewModalTpl.applicability}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
                  <span className="font-bold text-foreground">⚙️ {t('bestSettings')}</span>
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
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{t('positivePrompt')}</div>
                {previewModalTpl.positivePrompt}
              </div>

              {/* 按鈕動作 */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setPreviewModalTpl(null)}
                >
                  {t('close')}
                </Button>
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                  onClick={() => {
                    handleSelectImgTemplate(previewModalTpl)
                    setPreviewModalTpl(null)
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  {t('applyStyle')}
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
          initialCopy={t('imgCopy', { title: selectedImgTemplate.title, feeling: selectedImgTemplate.feeling, extra: imgUserPrompt.trim() ? t('imgCopyExtra', { k: imgUserPrompt.trim() }) : '' })}
          sourceName={`${t('title')} (${selectedImgTemplate.title})`}
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
          t('videoCopy', { title: selectedVideoTemplate.title, product: videoProductName ? t('videoCopyProduct', { p: videoProductName }) : '', key: videoKeyPoint ? t('videoCopyKey', { k: videoKeyPoint }) : '' })
        }
        sourceName={`${t('title')} - ${t('videoStoryboard')} (${selectedVideoTemplate.command})`}
      />
    </div>
  )
}
