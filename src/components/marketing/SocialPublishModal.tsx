'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  X, Share2, Check, CheckCircle2, AlertCircle, XCircle,
  ExternalLink, Loader2, RefreshCw, Sparkles, Send,
  Globe, ShieldAlert, ArrowUpRight, Copy, Eye, FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

export interface SocialPublishMedia {
  type: 'image' | 'video'
  url: string
  previewUrl?: string
  title?: string
  aspectRatio?: string
}

export interface SocialPublishModalProps {
  open: boolean
  onClose: () => void
  media: SocialPublishMedia | null
  initialCopy?: string
  sourceName?: string
}

export interface PlatformItem {
  id: string              // ID sent to /api/marketing/upload
  name: string            // Display name
  credKey: string         // Key in /api/social/credentials
  color: string
  badgeText: string
  supportsImage: boolean
  supportsVideo: boolean
  description: string
  guideUrl: string
}

const SOCIAL_PLATFORMS: PlatformItem[] = [
  {
    id: 'Facebook',
    name: 'Facebook 粉絲專頁',
    credKey: 'Facebook',
    color: '#1877F2',
    badgeText: 'Meta FB',
    supportsImage: true,
    supportsVideo: false,
    description: '發布至 Facebook 粉絲頁相簿貼文',
    guideUrl: 'https://developers.facebook.com/docs/pages/getting-started',
  },
  {
    id: 'Instagram',
    name: 'Instagram 貼文',
    credKey: 'Instagram',
    color: '#E1306C',
    badgeText: 'Meta IG',
    supportsImage: true,
    supportsVideo: false,
    description: '發布至 Instagram 商業帳號貼文',
    guideUrl: 'https://developers.facebook.com/docs/instagram-api/getting-started',
  },
  {
    id: 'Threads',
    name: 'Threads',
    credKey: 'Threads',
    color: '#000000',
    badgeText: 'Meta Threads',
    supportsImage: true,
    supportsVideo: false,
    description: '發布圖文至 Threads 串文',
    guideUrl: 'https://developers.facebook.com/docs/threads',
  },
  {
    id: 'FB Reels',
    name: 'Facebook Reels (短影音)',
    credKey: 'Facebook',
    color: '#1877F2',
    badgeText: 'FB Reels',
    supportsImage: false,
    supportsVideo: true,
    description: '發布至 Facebook 直式連續短片',
    guideUrl: 'https://developers.facebook.com/docs/pages/getting-started',
  },
  {
    id: 'IG Reels',
    name: 'Instagram Reels (短影音)',
    credKey: 'Instagram',
    color: '#E1306C',
    badgeText: 'IG Reels',
    supportsImage: false,
    supportsVideo: true,
    description: '發布至 Instagram 直式短影音',
    guideUrl: 'https://developers.facebook.com/docs/instagram-api/getting-started',
  },
  {
    id: 'YouTube Shorts',
    name: 'YouTube Shorts (短影音)',
    credKey: 'YouTube Shorts',
    color: '#FF0000',
    badgeText: 'YouTube',
    supportsImage: false,
    supportsVideo: true,
    description: '發布至 YouTube 官方頻道 Shorts',
    guideUrl: 'https://developers.google.com/youtube/v3/guides/uploading_a_video',
  },
  {
    id: 'TikTok',
    name: 'TikTok 抖音國際版',
    credKey: 'TikTok',
    color: '#010101',
    badgeText: 'TikTok',
    supportsImage: false,
    supportsVideo: true,
    description: '發布短影音至 TikTok 創作者/品牌帳號',
    guideUrl: 'https://developers.tiktok.com/doc/content-posting-api-get-started/',
  },
  {
    id: 'LINE VOOM',
    name: 'LINE 官方帳號 / VOOM',
    credKey: 'LINE VOOM',
    color: '#00B900',
    badgeText: 'LINE',
    supportsImage: true,
    supportsVideo: false,
    description: '以 LINE 官方帳號廣播圖文發布',
    guideUrl: 'https://developers.line.biz/en/docs/messaging-api/',
  },
  {
    id: 'Twitter/X',
    name: 'Twitter / X',
    credKey: 'Twitter/X',
    color: '#000000',
    badgeText: 'X / Twitter',
    supportsImage: true,
    supportsVideo: true,
    description: '發布圖文推文至 X 帳號',
    guideUrl: 'https://developer.twitter.com/en/docs/authentication/oauth-1-0a',
  },
  {
    id: 'LinkedIn',
    name: 'LinkedIn',
    credKey: 'LinkedIn',
    color: '#0A66C2',
    badgeText: 'LinkedIn',
    supportsImage: true,
    supportsVideo: false,
    description: '分享至個人動態或公司官方頁',
    guideUrl: 'https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/share-api',
  },
  {
    id: 'Zalo',
    name: 'Zalo Official Account',
    credKey: 'Zalo',
    color: '#0068FF',
    badgeText: 'Zalo OA',
    supportsImage: true,
    supportsVideo: false,
    description: '發布至越南 Zalo 官方帳號文章',
    guideUrl: 'https://developers.zalo.me/docs/official-account/article',
  },
]

const QUICK_TAGS = [
  '#新品上市',
  '#品牌活動',
  '#限時特惠',
  '#AI視覺創作',
  '#好物推薦',
  '#質感生活',
  '#熱銷爆款',
]

interface UploadResult {
  platform: string
  ok: boolean
  postId?: string
  error?: string
}

export function SocialPublishModal({
  open,
  onClose,
  media,
  initialCopy = '',
  sourceName,
}: SocialPublishModalProps) {
  // 平台憑證連線狀態
  const [credStatus, setCredStatus] = useState<Record<string, boolean>>({})
  const [loadingCreds, setLoadingCreds] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])

  // 文案狀態
  const [copyText, setCopyText] = useState('')
  const [aiGeneratingCopy, setAiGeneratingCopy] = useState(false)

  // 發布中狀態
  const [publishing, setPublishing] = useState(false)
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<'edit' | 'result'>('edit')

  // 當 modal 開啟或傳入資料改變時初始化
  useEffect(() => {
    if (open) {
      setCopyText(initialCopy || '')
      setUploadResults(null)
      setPublishError(null)
      setActiveStep('edit')
      fetchCredentials()
    }
  }, [open, initialCopy])

  // 抓取已綁定憑證
  const fetchCredentials = useCallback(async () => {
    setLoadingCreds(true)
    try {
      const res = await fetch('/api/social/credentials')
      if (res.ok) {
        const data = await res.json()
        const platforms = data.platforms || {}
        const connectedMap: Record<string, boolean> = {}
        for (const [k, v] of Object.entries(platforms)) {
          connectedMap[k] = Boolean((v as { is_connected?: boolean })?.is_connected)
        }
        setCredStatus(connectedMap)

        // 自動勾選所有適用且已連線的平台
        const isVid = media?.type === 'video'
        const applicable = SOCIAL_PLATFORMS.filter(p =>
          isVid ? p.supportsVideo : p.supportsImage
        )
        const autoSelected = applicable
          .filter(p => connectedMap[p.credKey])
          .map(p => p.id)

        setSelectedPlatforms(autoSelected)
      }
    } catch (e) {
      console.error('[SocialPublishModal] fetch credentials failed:', e)
    } finally {
      setLoadingCreds(false)
    }
  }, [media?.type])

  // 適用於目前媒體類型的平台
  const applicablePlatforms = useMemo(() => {
    if (!media) return []
    const isVid = media.type === 'video'
    return SOCIAL_PLATFORMS.filter(p => isVid ? p.supportsVideo : p.supportsImage)
  }, [media])

  // 切換選中平台
  const togglePlatform = (id: string, isConnected: boolean) => {
    if (!isConnected) return
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // 全選已連線平台
  const selectAllConnected = () => {
    const connected = applicablePlatforms
      .filter(p => credStatus[p.credKey])
      .map(p => p.id)
    setSelectedPlatforms(connected)
  }

  // 清除選擇
  const deselectAll = () => {
    setSelectedPlatforms([])
  }

  // 加入快捷標籤
  const handleAddTag = (tag: string) => {
    setCopyText(prev => {
      const trimmed = prev.trim()
      if (trimmed.includes(tag)) return prev
      return trimmed ? `${trimmed} ${tag}` : tag
    })
  }

  // AI 快速生成社群貼文文案
  const handleGenerateAiCopy = async () => {
    setAiGeneratingCopy(true)
    try {
      const mediaTitle = media?.title || sourceName || '精選視覺'
      const promptText = `請為這張行銷視覺圖片撰寫一段生動吸引人、適合社群平台（FB、IG、Threads）的繁體中文發布文案。
主題/風格：${mediaTitle}
原本附帶資訊：${copyText || '無'}
要求：
1. 包含吸睛標題、2-3段情感共鳴或好處描述
2. 明確的行動呼籲（CTA）
3. 搭配適當 emoji 與 4-6 個精準熱門 Hashtags
請直接輸出文案內容，不要有任何多餘的引言或客套話。`

      const res = await fetch('/api/marketing/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copyTypes: ['instagram_caption'],
          userInstructions: promptText,
          topic: mediaTitle,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = data?.copies?.instagram_caption || data?.copy || data?.result
        if (text) {
          setCopyText(text)
        } else {
          // Fallback simple copy
          setCopyText(`✨ ${mediaTitle} 重磅登場！\n\n以極致視覺美學打造，為您的品牌帶來前所未有的視覺饗宴與震撼體驗 🔥\n\n立即了解更多或私訊我們，搶先體驗最新亮點！\n\n#品牌視覺 #新品推薦 #行銷靈感 #質感設計 #AI視覺`)
        }
      } else {
        // Fallback simple copy
        setCopyText(`✨ ${mediaTitle} 重磅登場！\n\n以極致視覺美學打造，為您的品牌帶來前所未有的視覺饗宴與震撼體驗 🔥\n\n立即了解更多或私訊我們，搶先體驗最新亮點！\n\n#品牌視覺 #新品推薦 #行銷靈感 #質感設計 #AI視覺`)
      }
    } catch {
      setCopyText(`✨ ${media?.title || '精選視覺'} 重磅登場！\n\n極致美感與細節呈現，立即關注我們掌握第一手精彩消息！\n\n#品牌行銷 #質感生活 #新品推薦`)
    } finally {
      setAiGeneratingCopy(false)
    }
  }

  // 執行上傳發布
  const handlePublish = async () => {
    if (!media?.url) {
      setPublishError('找不到待發布的媒體素材')
      return
    }

    if (selectedPlatforms.length === 0) {
      setPublishError('請至少勾選一個已連線的社群平台')
      return
    }

    if (!copyText.trim()) {
      setPublishError('請輸入社群貼文文案')
      return
    }

    setPublishing(true)
    setPublishError(null)

    try {
      let resolvedUrl = media.url

      // 若為 data: URL，先透過 /api/marketing/upload-file 上傳轉存成公有 URL
      if (resolvedUrl.startsWith('data:')) {
        const blob = await (await fetch(resolvedUrl)).blob()
        const fd = new FormData()
        fd.append('file', blob, `social-media-${Date.now()}.${media.type === 'video' ? 'mp4' : 'png'}`)
        fd.append('category', 'image')

        const upRes = await fetch('/api/marketing/upload-file', {
          method: 'POST',
          body: fd,
        })

        if (!upRes.ok) {
          const errData = await upRes.json().catch(() => ({}))
          throw new Error(errData.error || '媒體檔案轉存失敗，請重試')
        }

        const upData = await upRes.json()
        if (!upData.url) throw new Error('無法取得媒體公有連結')
        resolvedUrl = upData.url
      }

      // 發送上傳請求
      const payload = {
        platforms: selectedPlatforms,
        imageUrls: media.type === 'image' ? [resolvedUrl] : [],
        videoUrl: media.type === 'video' ? resolvedUrl : undefined,
        copyText: copyText.trim(),
      }

      const res = await fetch('/api/marketing/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error(data.error || '目前方案未開放自動上傳平台，請升級至 PRO 以上方案')
        }
        throw new Error(data.error || '發布失敗，請稍後再試')
      }

      const results: UploadResult[] = data.results || []
      setUploadResults(results)
      setActiveStep('result')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setPublishError(msg)
    } finally {
      setPublishing(false)
    }
  }

  if (!open || !media) return null

  const connectedCount = applicablePlatforms.filter(p => credStatus[p.credKey]).length
  const successCount = uploadResults?.filter(r => r.ok).length ?? 0
  const failCount = uploadResults?.filter(r => !r.ok).length ?? 0

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in-50 duration-200">
      <div
        className="relative bg-background border border-border/80 w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* 頂部 Modal Header */}
        <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">一鍵串接上傳中心</h2>
                <Badge variant="secondary" className="text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border-blue-200">
                  {media.type === 'video' ? '短影音發布' : '圖文發布'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                直接將 AI 創作成果發布至 Facebook、Instagram、Threads、TikTok、YouTube 等社群平台
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/marketing-auto/platforms"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-border/60 hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>憑證設定中心</span>
            </Link>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal 主體內容 */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeStep === 'edit' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 左側：媒體預覽與來源資訊 (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-muted/40 border rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-primary" />
                      待發布媒體預覽
                    </span>
                    {media.aspectRatio && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {media.aspectRatio}
                      </Badge>
                    )}
                  </div>

                  <div className="relative rounded-lg overflow-hidden bg-black/5 dark:bg-black/40 flex items-center justify-center min-h-[220px] max-h-[320px]">
                    {media.type === 'video' ? (
                      <video
                        src={media.url}
                        controls
                        className="max-h-[300px] w-auto rounded-lg shadow-sm"
                      />
                    ) : (
                      <img
                        src={media.previewUrl || media.url}
                        alt="Media Preview"
                        className="max-h-[300px] w-auto object-contain rounded-lg shadow-sm"
                      />
                    )}
                  </div>

                  {sourceName && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 truncate pt-1">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">來源：{sourceName}</span>
                    </div>
                  )}
                </div>

                {/* 連線狀況提要 */}
                <div className="p-3 rounded-xl border bg-card text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">社群連線概況</span>
                    <span className="font-semibold text-foreground">
                      {connectedCount} / {applicablePlatforms.length} 個已綁定
                    </span>
                  </div>
                  {connectedCount === 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] flex items-start gap-2">
                      <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        尚未綁定社群平台發文憑證。請先前往
                        <Link
                          href="/marketing-auto/platforms"
                          target="_blank"
                          className="font-bold underline ml-1 inline-flex items-center gap-0.5 text-amber-800 dark:text-amber-300"
                        >
                          平台連線中心
                          <ArrowUpRight className="h-3 w-3 inline" />
                        </Link>
                        設定粉專 Token 或 API 金鑰。
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 右側：平台選擇與貼文文案編輯 (7 cols) */}
              <div className="lg:col-span-7 space-y-5">
                {/* 平台選擇 */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-blue-600" />
                      選擇發布目標平台
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={selectAllConnected}
                        className="h-6 px-2 text-[11px] text-blue-600 hover:text-blue-700"
                      >
                        全選已連線
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={deselectAll}
                        className="h-6 px-2 text-[11px] text-muted-foreground"
                      >
                        清除
                      </Button>
                      <button
                        type="button"
                        onClick={fetchCredentials}
                        disabled={loadingCreds}
                        className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="重新整理連線狀態"
                      >
                        <RefreshCw className={`h-3 w-3 ${loadingCreds ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {applicablePlatforms.map(platform => {
                      const isConnected = Boolean(credStatus[platform.credKey])
                      const isSelected = selectedPlatforms.includes(platform.id)

                      return (
                        <div
                          key={platform.id}
                          onClick={() => togglePlatform(platform.id, isConnected)}
                          className={`relative border rounded-xl p-2.5 text-left transition-all select-none flex items-start gap-2.5 ${
                            !isConnected
                              ? 'opacity-60 bg-muted/20 border-dashed border-border/60 cursor-not-allowed'
                              : isSelected
                              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-xs cursor-pointer ring-1 ring-blue-500/20'
                              : 'border-border/80 bg-card hover:border-border hover:bg-muted/30 cursor-pointer'
                          }`}
                        >
                          {/* 勾選圈 */}
                          <div
                            className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                              !isConnected
                                ? 'border-muted-foreground/30 bg-muted/40'
                                : isSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-muted-foreground/40 bg-background'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold text-xs text-foreground truncate">
                                {platform.name}
                              </span>
                              {isConnected ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  已連線
                                </span>
                              ) : (
                                <Link
                                  href="/marketing-auto/platforms"
                                  target="_blank"
                                  onClick={e => e.stopPropagation()}
                                  className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary underline shrink-0"
                                >
                                  綁定 ↗
                                </Link>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {platform.description}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 貼文文案編輯 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-indigo-600" />
                      貼文文案 / 說明
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateAiCopy}
                      disabled={aiGeneratingCopy}
                      className="h-6 px-2 text-[11px] gap-1 font-semibold text-indigo-600 border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100"
                    >
                      {aiGeneratingCopy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      <span>AI 智慧潤飾文案</span>
                    </Button>
                  </div>

                  <Textarea
                    value={copyText}
                    onChange={e => setCopyText(e.target.value)}
                    placeholder="輸入社群貼文內容、促銷亮點、行動呼籲與標籤..."
                    rows={4}
                    className="text-xs leading-relaxed resize-y min-h-[90px] rounded-xl"
                  />

                  {/* 快速標籤清單 */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[11px] text-muted-foreground shrink-0">常用標籤：</span>
                    {QUICK_TAGS.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className="text-[10px] px-2 py-0.5 rounded-full border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>文案字數：{copyText.length} 字</span>
                    <span className="text-[10px]">
                      建議：Twitter 限制 280 字｜Threads 限制 500 字｜IG 限制 2,200 字
                    </span>
                  </div>
                </div>

                {/* 錯誤訊息 */}
                {publishError && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2 animate-in fade-in-50">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="flex-1">{publishError}</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 發布成果展示區 */
            <div className="py-4 space-y-6 animate-in fade-in-50 duration-300">
              <div className="text-center space-y-2">
                <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg ${
                  successCount > 0 ? 'bg-emerald-600' : 'bg-destructive'
                }`}>
                  {successCount > 0 ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  社群平台發布作業完成
                </h3>
                <p className="text-xs text-muted-foreground">
                  總計執行 {uploadResults?.length ?? 0} 個平台｜成功：<span className="text-emerald-600 font-bold">{successCount}</span> 個｜失敗：<span className="text-rose-600 font-bold">{failCount}</span> 個
                </p>
              </div>

              {/* 平台成果卡片 */}
              <div className="space-y-2 max-w-xl mx-auto">
                {uploadResults?.map((res, i) => (
                  <div
                    key={i}
                    className={`border rounded-xl p-3 flex items-center justify-between gap-3 ${
                      res.ok
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                        : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        res.ok ? 'bg-emerald-500/20 text-emerald-600' : 'bg-rose-500/20 text-rose-600'
                      }`}>
                        {res.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          <span>{res.platform}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                            res.ok ? 'border-emerald-300 text-emerald-700' : 'border-rose-300 text-rose-700'
                          }`}>
                            {res.ok ? '發布成功' : '發布失敗'}
                          </Badge>
                        </div>
                        {res.postId && (
                          <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
                            貼文 ID: {res.postId}
                          </p>
                        )}
                        {res.error && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 break-words">
                            {res.error}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部按鈕區 */}
        <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between shrink-0">
          {activeStep === 'edit' ? (
            <>
              <div className="text-xs text-muted-foreground">
                已勾選 <b className="text-foreground">{selectedPlatforms.length}</b> 個平台
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={publishing}
                  className="text-xs h-9 px-4"
                >
                  取消
                </Button>

                <Button
                  onClick={handlePublish}
                  disabled={publishing || selectedPlatforms.length === 0}
                  className="text-xs h-9 px-5 gap-1.5 font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>正在同步發布中...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>🚀 立即同步發布</span>
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setActiveStep('edit')}
                className="text-xs h-9 px-4 gap-1.5"
              >
                ← 返回重新編輯
              </Button>

              <div className="flex items-center gap-2">
                <Link href="/marketing-auto/platforms" target="_blank">
                  <Button variant="outline" className="text-xs h-9 px-3 gap-1">
                    <ExternalLink className="h-3 w-3" />
                    平台連線管理
                  </Button>
                </Link>
                <Button
                  onClick={onClose}
                  className="text-xs h-9 px-5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  完成並關閉
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
