'use client'

import React, { useState, useRef, useCallback, useId, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  ChevronLeft, Upload, Sparkles, Loader2, Image as ImageIcon,
  Wand2, Palette, ArrowUpToLine, Scissors, Video, Plus, X,
  ArrowRight, Play, Download, Copy, RefreshCw, MessageSquare,
  Brush, Eraser, Trash2, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType = 'input' | 'edit' | 'style' | 'enhance' | 'bg-remove' | 'video' | 'inpaint' | 'composite'
type NodeStatus = 'idle' | 'processing' | 'done' | 'error'

interface PipelineNode {
  id: string
  type: NodeType
  inputUrl: string | null
  outputUrl: string | null
  prompt: string
  stylePreset: string
  strength: number
  videoDuration: string
  videoAspect: string
  maskDataUrl: string | null
  inpaintMode: 'text' | 'reference'
  referenceImageDataUrl: string | null
  referenceImageMimeType: string | null
  // composite node: source B
  sourceBImageDataUrl: string | null
  sourceBImageMimeType: string | null
  sourceBMaskDataUrl: string | null
  compositePrompt: string
  status: NodeStatus
  error: string | null
  videoRequestId: string | null
}

const NODE_META: Record<NodeType, { labelKey: string; icon: React.ElementType; color: string; descKey: string }> = {
  input:      { labelKey: 'studio.nodes.input',     icon: Upload,        color: 'from-slate-500 to-gray-600',     descKey: 'studio.nodes.inputDesc' },
  edit:       { labelKey: 'studio.nodes.edit',      icon: Wand2,         color: 'from-violet-500 to-purple-600',  descKey: 'studio.nodes.editDesc' },
  inpaint:    { labelKey: 'studio.nodes.inpaint',   icon: Brush,         color: 'from-rose-500 to-pink-600',      descKey: 'studio.nodes.inpaintDesc' },
  composite:  { labelKey: 'studio.nodes.composite', icon: Layers,        color: 'from-amber-500 to-orange-600',   descKey: 'studio.nodes.compositeDesc' },
  style:      { labelKey: 'studio.nodes.style',     icon: Palette,       color: 'from-pink-500 to-rose-600',      descKey: 'studio.nodes.styleDesc' },
  enhance:    { labelKey: 'studio.nodes.enhance',   icon: ArrowUpToLine, color: 'from-blue-500 to-cyan-600',      descKey: 'studio.nodes.enhanceDesc' },
  'bg-remove':{ labelKey: 'studio.nodes.bgRemove',  icon: Scissors,      color: 'from-teal-500 to-emerald-600',   descKey: 'studio.nodes.bgRemoveDesc' },
  video:      { labelKey: 'studio.nodes.video',     icon: Video,         color: 'from-orange-500 to-amber-600',   descKey: 'studio.nodes.videoDesc' },
}

const STYLE_PRESETS = [
  { key: 'watercolor',   labelKey: 'studio.style.watercolor' },
  { key: 'anime',        labelKey: 'studio.style.anime' },
  { key: 'illustration', labelKey: 'studio.style.illustration' },
  { key: 'cinematic',    labelKey: 'studio.style.cinematic' },
  { key: 'realistic',    labelKey: 'studio.style.realistic' },
  { key: 'oilpainting',  labelKey: 'studio.style.oilpainting' },
  { key: 'sketch',       labelKey: 'studio.style.sketch' },
  { key: 'cyberpunk',    labelKey: 'studio.style.cyberpunk' },
]

const ADDABLE_TYPES: NodeType[] = ['edit', 'inpaint', 'composite', 'style', 'enhance', 'bg-remove', 'video']

// ─── Client-side crop helper ──────────────────────────────────────────────────
// Extracts the bounding-box region of B masked by its mask, returns base64 PNG
async function extractMaskedCrop(imageDataUrl: string, maskDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const mask = new Image()
    let loaded = 0
    const onLoad = () => {
      if (++loaded < 2) return
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = mask.width; maskCanvas.height = mask.height
      const mCtx = maskCanvas.getContext('2d')!
      mCtx.drawImage(mask, 0, 0)
      const mData = mCtx.getImageData(0, 0, mask.width, mask.height).data

      // Find bounding box of white pixels in mask
      let minX = mask.width, minY = mask.height, maxX = 0, maxY = 0
      for (let y = 0; y < mask.height; y++) {
        for (let x = 0; x < mask.width; x++) {
          const i = (y * mask.width + x) * 4
          if (mData[i] > 128) { // white = area to extract
            minX = Math.min(minX, x); minY = Math.min(minY, y)
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
          }
        }
      }
      if (maxX < minX) { resolve(imageDataUrl); return } // no mask → use whole image

      const cropW = maxX - minX + 1
      const cropH = maxY - minY + 1
      const scaleX = img.width / mask.width
      const scaleY = img.height / mask.height

      const cropCanvas = document.createElement('canvas')
      cropCanvas.width = Math.round(cropW * scaleX)
      cropCanvas.height = Math.round(cropH * scaleY)
      const cCtx = cropCanvas.getContext('2d')!
      cCtx.drawImage(
        img,
        Math.round(minX * scaleX), Math.round(minY * scaleY),
        cropCanvas.width, cropCanvas.height,
        0, 0, cropCanvas.width, cropCanvas.height,
      )
      resolve(cropCanvas.toDataURL('image/jpeg', 0.92).replace(/^data:[^;]+;base64,/, ''))
    }
    img.onload = onLoad; img.onerror = reject; img.src = imageDataUrl
    mask.onload = onLoad; mask.onerror = reject; mask.src = maskDataUrl
  })
}

function makeNode(type: NodeType, id: string): PipelineNode {
  return {
    id, type,
    inputUrl: null, outputUrl: null,
    prompt: '', stylePreset: 'watercolor',
    strength: 0.75,
    videoDuration: '5', videoAspect: '16:9',
    maskDataUrl: null,
    inpaintMode: 'text',
    referenceImageDataUrl: null,
    referenceImageMimeType: null,
    sourceBImageDataUrl: null,
    sourceBImageMimeType: null,
    sourceBMaskDataUrl: null,
    compositePrompt: '',
    status: 'idle', error: null, videoRequestId: null,
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AiStudioPage() {
  const t = useTranslations('Marketing')
  const uid = useId()

  const [nodes, setNodes] = useState<PipelineNode[]>([
    makeNode('input', `${uid}-0`),
    makeNode('edit', `${uid}-1`),
  ])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [runningAll, setRunningAll] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const pipelineRef = useRef<HTMLDivElement>(null)

  const updateNode = useCallback((id: string, patch: Partial<PipelineNode>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n))
  }, [])

  const addNode = useCallback((type: NodeType) => {
    const id = `${uid}-${Date.now()}`
    setNodes(prev => [...prev, makeNode(type, id)])
    setPaletteOpen(false)
    setTimeout(() => pipelineRef.current?.scrollTo({ left: 99999, behavior: 'smooth' }), 50)
  }, [uid])

  const removeNode = useCallback((id: string) => {
    setNodes(prev => {
      const filtered = prev.filter(n => n.id !== id)
      return filtered.length === 0 ? [makeNode('input', `${uid}-${Date.now()}`)] : filtered
    })
  }, [uid])

  // Upload image for input node
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, nodeId: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      updateNode(nodeId, { outputUrl: url, inputUrl: url, status: 'done' })
      // propagate to next node
      setNodes(prev => {
        const idx = prev.findIndex(n => n.id === nodeId)
        if (idx === -1 || idx + 1 >= prev.length) return prev
        return prev.map((n, i) => i === idx + 1 ? { ...n, inputUrl: url } : n)
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [updateNode])

  // Run a single non-input node
  const runNode = useCallback(async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node || node.type === 'input') return

    const inputUrl = node.inputUrl
    if (!inputUrl) {
      updateNode(nodeId, { status: 'error', error: t('studio.errNoInput') })
      return
    }

    updateNode(nodeId, { status: 'processing', error: null })

    try {
      if (node.type === 'video') {
        const res = await fetch('/api/marketing/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: node.prompt || 'smooth camera movement, cinematic',
            model: 'kling-img2video',
            imageUrl: inputUrl,
            duration: node.videoDuration,
            aspectRatio: node.videoAspect,
            scriptId: 0,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        updateNode(nodeId, { videoRequestId: data.requestId, status: 'processing' })
        await pollVideo(nodeId, data.requestId, 'kling-img2video')
      } else if (node.type === 'inpaint') {
        if (!node.maskDataUrl) {
          updateNode(nodeId, { status: 'error', error: t('studio.errNoMask') })
          return
        }
        const refBase64 = node.referenceImageDataUrl
          ? node.referenceImageDataUrl.replace(/^data:[^;]+;base64,/, '')
          : undefined
        const res = await fetch('/api/marketing/ai-studio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'inpaint',
            imageUrl: inputUrl,
            maskDataUrl: node.maskDataUrl,
            prompt: node.prompt,
            referenceImageBase64: refBase64,
            referenceImageMimeType: node.referenceImageMimeType ?? 'image/jpeg',
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        const outUrl = data.url
        updateNode(nodeId, { status: 'done', outputUrl: outUrl, error: null })
        setNodes(prev => {
          const idx = prev.findIndex(n => n.id === nodeId)
          if (idx === -1 || idx + 1 >= prev.length) return prev
          if (prev[idx + 1].type === 'input') return prev
          return prev.map((n, i) => i === idx + 1 ? { ...n, inputUrl: outUrl } : n)
        })
      } else if (node.type === 'composite') {
        if (!node.maskDataUrl) {
          updateNode(nodeId, { status: 'error', error: t('studio.errNoMaskA') })
          return
        }
        if (!node.sourceBImageDataUrl || !node.sourceBMaskDataUrl) {
          updateNode(nodeId, { status: 'error', error: t('studio.errNoBSource') })
          return
        }
        // Extract B's selected crop client-side
        const bCropBase64 = await extractMaskedCrop(node.sourceBImageDataUrl, node.sourceBMaskDataUrl)
        const res = await fetch('/api/marketing/ai-studio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'composite',
            imageUrl: inputUrl,
            maskDataUrl: node.maskDataUrl,
            sourceBCropBase64: bCropBase64,
            sourceBMimeType: node.sourceBImageMimeType ?? 'image/jpeg',
            prompt: node.compositePrompt,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        const outUrl = data.url
        updateNode(nodeId, { status: 'done', outputUrl: outUrl, error: null })
        setNodes(prev => {
          const idx = prev.findIndex(n => n.id === nodeId)
          if (idx === -1 || idx + 1 >= prev.length) return prev
          if (prev[idx + 1].type === 'input') return prev
          return prev.map((n, i) => i === idx + 1 ? { ...n, inputUrl: outUrl } : n)
        })
      } else {
        const res = await fetch('/api/marketing/ai-studio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: node.type,
            imageUrl: inputUrl,
            prompt: node.prompt,
            strength: node.strength,
            stylePreset: node.stylePreset,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        const outUrl = data.url
        updateNode(nodeId, { status: 'done', outputUrl: outUrl, error: null })
        setNodes(prev => {
          const idx = prev.findIndex(n => n.id === nodeId)
          if (idx === -1 || idx + 1 >= prev.length) return prev
          if (prev[idx + 1].type === 'input') return prev
          return prev.map((n, i) => i === idx + 1 ? { ...n, inputUrl: outUrl } : n)
        })
      }
    } catch (err) {
      updateNode(nodeId, { status: 'error', error: String(err) })
    }
  }, [nodes, t, updateNode])

  const pollVideo = useCallback(async (nodeId: string, requestId: string, model: string) => {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000))
      try {
        const res = await fetch(`/api/marketing/generate-video?requestId=${requestId}&model=${model}`)
        const data = await res.json()
        if (data.status === 'completed' && data.url) {
          updateNode(nodeId, { status: 'done', outputUrl: data.url, error: null })
          return
        }
        if (data.status === 'failed') {
          updateNode(nodeId, { status: 'error', error: data.error ?? '影片生成失敗' })
          return
        }
      } catch { /* keep polling */ }
    }
    updateNode(nodeId, { status: 'error', error: '影片生成逾時' })
  }, [updateNode])

  // Run all non-input nodes in sequence
  const runAll = useCallback(async () => {
    setRunningAll(true)
    let lastOutput: string | null = null

    for (const node of nodes) {
      if (node.type === 'input') {
        lastOutput = node.outputUrl
        continue
      }
      if (!lastOutput) continue
      updateNode(node.id, { inputUrl: lastOutput, status: 'processing', error: null })

      try {
        if (node.type === 'video') {
          const res = await fetch('/api/marketing/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: node.prompt || 'smooth camera movement, cinematic',
              model: 'kling-img2video',
              imageUrl: lastOutput,
              duration: node.videoDuration,
              aspectRatio: node.videoAspect,
              scriptId: 0,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          updateNode(node.id, { videoRequestId: data.requestId })
          await pollVideo(node.id, data.requestId, 'kling-img2video')
          break
        } else if (node.type === 'inpaint') {
          if (!node.maskDataUrl) {
            updateNode(node.id, { status: 'error', error: t('studio.errNoMask') })
            break
          }
          const refBase64 = node.referenceImageDataUrl
            ? node.referenceImageDataUrl.replace(/^data:[^;]+;base64,/, '')
            : undefined
          const res = await fetch('/api/marketing/ai-studio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'inpaint',
              imageUrl: lastOutput,
              maskDataUrl: node.maskDataUrl,
              prompt: node.prompt,
              referenceImageBase64: refBase64,
              referenceImageMimeType: node.referenceImageMimeType ?? 'image/jpeg',
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          lastOutput = data.url
          updateNode(node.id, { status: 'done', outputUrl: lastOutput, error: null })
        } else if (node.type === 'composite') {
          if (!node.maskDataUrl || !node.sourceBImageDataUrl || !node.sourceBMaskDataUrl) {
            updateNode(node.id, { status: 'error', error: t('studio.errNoBSource') })
            break
          }
          const bCropBase64 = await extractMaskedCrop(node.sourceBImageDataUrl, node.sourceBMaskDataUrl)
          const res = await fetch('/api/marketing/ai-studio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'composite',
              imageUrl: lastOutput,
              maskDataUrl: node.maskDataUrl,
              sourceBCropBase64: bCropBase64,
              sourceBMimeType: node.sourceBImageMimeType ?? 'image/jpeg',
              prompt: node.compositePrompt,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          lastOutput = data.url
          updateNode(node.id, { status: 'done', outputUrl: lastOutput, error: null })
        } else {
          const res = await fetch('/api/marketing/ai-studio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: node.type,
              imageUrl: lastOutput,
              prompt: node.prompt,
              strength: node.strength,
              stylePreset: node.stylePreset,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          lastOutput = data.url
          updateNode(node.id, { status: 'done', outputUrl: lastOutput, error: null })
        }
      } catch (err) {
        updateNode(node.id, { status: 'error', error: String(err) })
        break
      }
    }
    setRunningAll(false)
  }, [nodes, t, updateNode, pollVideo])

  const inputNode = nodes.find(n => n.type === 'input')
  const canRunAll = !!inputNode?.outputUrl && !runningAll

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50/50 dark:bg-background">
      {/* Header */}
      <div className="shrink-0 border-b bg-white dark:bg-card px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/marketing" className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors">
            <ChevronLeft className="h-4 w-4" />
            {t('center')}
          </Link>
          <span className="text-muted-foreground">/</span>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-pink-600 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm">{t('studio.title')}</span>
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
            {t('studio.badge')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={runAll}
            disabled={!canRunAll}
            className="gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700"
          >
            {runningAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {runningAll ? t('studio.running') : t('studio.runAll')}
          </Button>
        </div>
      </div>

      {/* Hint bar */}
      <div className="shrink-0 bg-violet-50 dark:bg-violet-950/20 border-b border-violet-100 dark:border-violet-900 px-4 py-2">
        <p className="text-xs text-violet-700 dark:text-violet-400">
          <MessageSquare className="inline h-3.5 w-3.5 mr-1" />
          {t('studio.hint')}
        </p>
      </div>

      {/* Pipeline + Sidebar layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar: Node Palette */}
        <div className="hidden lg:flex w-52 shrink-0 border-r bg-white dark:bg-card flex-col py-4 gap-1 px-3 overflow-y-auto">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">{t('studio.palette')}</p>
          {ADDABLE_TYPES.map(type => {
            const meta = NODE_META[type]
            const Icon = meta.icon
            return (
              <button
                key={type}
                onClick={() => addNode(type)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm transition-colors text-left group"
              >
                <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${meta.color} flex items-center justify-center shrink-0`}>
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm leading-tight">{t(meta.labelKey)}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{t(meta.descKey)}</p>
                </div>
              </button>
            )
          })}
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">{t('studio.tipTitle')}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{t('studio.tip')}</p>
          </div>
        </div>

        {/* Mobile palette toggle */}
        <div className="lg:hidden fixed bottom-4 right-4 z-50">
          <Button
            size="sm"
            onClick={() => setPaletteOpen(p => !p)}
            className="rounded-full h-10 w-10 p-0 shadow-lg bg-violet-600 hover:bg-violet-700"
          >
            <Plus className="h-5 w-5" />
          </Button>
          {paletteOpen && (
            <div className="absolute bottom-12 right-0 bg-white dark:bg-card border rounded-xl shadow-xl p-2 flex flex-col gap-1 min-w-[180px]">
              {ADDABLE_TYPES.map(type => {
                const meta = NODE_META[type]
                const Icon = meta.icon
                return (
                  <button
                    key={type}
                    onClick={() => addNode(type)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm"
                  >
                    <div className={`h-6 w-6 rounded-md bg-gradient-to-br ${meta.color} flex items-center justify-center shrink-0`}>
                      <Icon className="h-3 w-3 text-white" />
                    </div>
                    {t(meta.labelKey)}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Pipeline canvas */}
        <div
          ref={pipelineRef}
          className="flex-1 overflow-x-auto overflow-y-auto p-6"
        >
          <div className="flex items-start gap-0 min-w-max pb-8">
            {nodes.map((node, idx) => (
              <div key={node.id} className="flex items-center">
                <NodeCard
                  node={node}
                  index={idx}
                  isFirst={idx === 0}
                  isLast={idx === nodes.length - 1}
                  canRemove={nodes.length > 1 && !(idx === 0 && node.type === 'input')}
                  onUpdate={patch => updateNode(node.id, patch)}
                  onRun={() => runNode(node.id)}
                  onRemove={() => removeNode(node.id)}
                  onUpload={e => handleUpload(e, node.id)}
                  fileRef={node.type === 'input' ? fileRef : undefined}
                  t={t}
                />
                {idx < nodes.length - 1 && (
                  <div className="flex items-center px-1 mt-[-60px]">
                    <div className="w-8 h-0.5 bg-gradient-to-r from-violet-300 to-pink-300 dark:from-violet-700 dark:to-pink-700" />
                    <ArrowRight className="h-4 w-4 text-violet-400 dark:text-violet-600 -ml-1 shrink-0" />
                  </div>
                )}
              </div>
            ))}

            {/* Add node button at end */}
            <div className="flex items-center ml-1 mt-[-60px]">
              <div className="w-8 h-0.5 bg-border" />
              <button
                onClick={() => setPaletteOpen(p => !p)}
                className="h-10 w-10 rounded-full border-2 border-dashed border-border hover:border-violet-400 flex items-center justify-center text-muted-foreground hover:text-violet-500 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
              {paletteOpen && (
                <div className="absolute ml-12 bg-white dark:bg-card border rounded-xl shadow-xl p-2 flex flex-col gap-1 min-w-[180px] z-50">
                  {ADDABLE_TYPES.map(type => {
                    const meta = NODE_META[type]
                    const Icon = meta.icon
                    return (
                      <button
                        key={type}
                        onClick={() => addNode(type)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm text-left"
                      >
                        <div className={`h-6 w-6 rounded-md bg-gradient-to-br ${meta.color} flex items-center justify-center shrink-0`}>
                          <Icon className="h-3 w-3 text-white" />
                        </div>
                        {t(meta.labelKey)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => {
          const inputNode = nodes.find(n => n.type === 'input')
          if (inputNode) handleUpload(e, inputNode.id)
        }}
      />
    </div>
  )
}

// ─── Node Card ─────────────────────────────────────────────────────────────────

interface NodeCardProps {
  node: PipelineNode
  index: number
  isFirst: boolean
  isLast: boolean
  canRemove: boolean
  onUpdate: (patch: Partial<PipelineNode>) => void
  onRun: () => void
  onRemove: () => void
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  fileRef?: React.RefObject<HTMLInputElement | null>
  t: ReturnType<typeof useTranslations<'Marketing'>>
}

function NodeCard({ node, index, canRemove, onUpdate, onRun, onRemove, onUpload, fileRef, t }: NodeCardProps) {
  const meta = NODE_META[node.type]
  const Icon = meta.icon
  const localFileRef = useRef<HTMLInputElement>(null)
  const activeFileRef = fileRef ?? localFileRef
  const [suggesting, setSuggesting] = useState(false)

  const displayUrl = node.outputUrl ?? node.inputUrl

  const aiSuggest = async () => {
    if (!node.inputUrl || suggesting) return
    setSuggesting(true)
    try {
      const res = await fetch('/api/marketing/ai-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'suggest', imageUrl: node.inputUrl, mode: node.type }),
      })
      const data = await res.json()
      if (res.ok && data.suggestion) onUpdate({ prompt: data.suggestion })
    } catch { /* ignore */ } finally {
      setSuggesting(false)
    }
  }

  return (
    <div className={cn(
      'w-64 rounded-2xl border-2 bg-white dark:bg-card shadow-sm overflow-hidden transition-all',
      node.status === 'processing' && 'border-violet-400 shadow-violet-100 dark:shadow-violet-900/30',
      node.status === 'done' && 'border-emerald-300 shadow-emerald-50 dark:shadow-emerald-900/20',
      node.status === 'error' && 'border-red-300',
      node.status === 'idle' && 'border-border hover:border-violet-200',
    )}>
      {/* Node Header */}
      <div className={`flex items-center gap-2.5 px-3 py-2.5 bg-gradient-to-r ${meta.color} bg-opacity-10`}>
        <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${meta.color} flex items-center justify-center shrink-0 shadow-sm`}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight text-white drop-shadow-sm">{t(meta.labelKey)}</p>
          <p className="text-[10px] text-white/80 leading-tight">{t(meta.descKey)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-bold text-white/70 bg-black/20 rounded px-1.5 py-0.5">
            #{index + 1}
          </span>
          {canRemove && (
            <button onClick={onRemove} className="text-white/70 hover:text-white transition-colors p-0.5">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Preview area */}
      <div className="relative">
        {node.type === 'video' && node.status === 'done' && node.outputUrl ? (
          <video
            src={node.outputUrl}
            controls
            className="w-full aspect-video bg-black"
          />
        ) : displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
            alt={t(meta.labelKey)}
            className="w-full aspect-square object-cover"
          />
        ) : (
          <div
            className={cn(
              'w-full aspect-square bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center gap-2 text-muted-foreground',
              node.type === 'input' && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors',
            )}
            onClick={node.type === 'input' ? () => activeFileRef.current?.click() : undefined}
          >
            <Icon className="h-8 w-8 opacity-20" />
            <p className="text-xs px-4 text-center">
              {node.type === 'input' ? t('studio.clickUpload') : t('studio.waitingInput')}
            </p>
          </div>
        )}

        {/* Processing overlay */}
        {node.status === 'processing' && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-xs font-medium">
              {node.type === 'video' ? t('studio.videoProcessing') : t('studio.processing')}
            </p>
          </div>
        )}

        {/* Upload zone for input */}
        {node.type === 'input' && displayUrl && (
          <button
            onClick={() => activeFileRef.current?.click()}
            className="absolute bottom-2 right-2 h-7 w-7 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Done indicator */}
        {node.status === 'done' && node.outputUrl && (
          <div className="absolute top-2 right-2 flex gap-1">
            <a
              href={node.outputUrl}
              download
              className="h-6 w-6 rounded-md bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="h-3 w-3" />
            </a>
            <button
              onClick={() => navigator.clipboard.writeText(node.outputUrl!)}
              className="h-6 w-6 rounded-md bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Config area */}
      <div className="px-3 py-2.5">
        {/* Input node */}
        {node.type === 'input' && (
          <div>
            <button
              onClick={() => activeFileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-violet-300 dark:border-violet-700 hover:border-violet-500 text-violet-600 dark:text-violet-400 text-xs font-medium transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              {displayUrl ? t('studio.replaceImage') : t('studio.uploadImage')}
            </button>
            <input
              ref={activeFileRef as React.RefObject<HTMLInputElement>}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onUpload}
            />
          </div>
        )}

        {/* Edit node */}
        {node.type === 'edit' && (
          <div className="space-y-2">
            <Textarea
              value={node.prompt}
              onChange={e => onUpdate({ prompt: e.target.value })}
              placeholder={t('studio.editPromptPh')}
              rows={2}
              className="text-xs resize-none"
            />
            <button
              type="button"
              onClick={aiSuggest}
              disabled={!node.inputUrl || suggesting}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-medium py-1.5 rounded-lg border border-violet-300 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 disabled:opacity-50 transition-colors"
            >
              {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {t('studio.aiSuggest')}
            </button>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{t('studio.editHint')}</p>
          </div>
        )}

        {/* Style node */}
        {node.type === 'style' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1">
              {STYLE_PRESETS.map(preset => (
                <button
                  key={preset.key}
                  onClick={() => onUpdate({ stylePreset: preset.key })}
                  className={cn(
                    'text-[10px] px-2 py-1.5 rounded-lg border transition-all font-medium',
                    node.stylePreset === preset.key
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                      : 'border-border hover:border-violet-300 text-muted-foreground',
                  )}
                >
                  {t(preset.labelKey)}
                </button>
              ))}
            </div>
            <Textarea
              value={node.prompt}
              onChange={e => onUpdate({ prompt: e.target.value })}
              placeholder={t('studio.stylePromptPh')}
              rows={1}
              className="text-xs resize-none"
            />
          </div>
        )}

        {/* Inpaint node */}
        {node.type === 'inpaint' && (
          <div className="space-y-2">
            <MaskCanvas
              imageUrl={node.inputUrl}
              maskDataUrl={node.maskDataUrl}
              onMaskChange={maskDataUrl => onUpdate({ maskDataUrl })}
              t={t}
            />
            {/* Mode toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden text-[10px] font-medium">
              <button
                onClick={() => onUpdate({ inpaintMode: 'text' })}
                className={cn(
                  'flex-1 py-1.5 transition-colors',
                  node.inpaintMode === 'text'
                    ? 'bg-rose-500 text-white'
                    : 'text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800',
                )}
              >
                {t('studio.inpaintModeText')}
              </button>
              <button
                onClick={() => onUpdate({ inpaintMode: 'reference' })}
                className={cn(
                  'flex-1 py-1.5 transition-colors',
                  node.inpaintMode === 'reference'
                    ? 'bg-rose-500 text-white'
                    : 'text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800',
                )}
              >
                {t('studio.inpaintModeRef')}
              </button>
            </div>

            {node.inpaintMode === 'text' ? (
              <div className="space-y-1.5">
                <Textarea
                  value={node.prompt}
                  onChange={e => onUpdate({ prompt: e.target.value })}
                  placeholder={t('studio.inpaintPromptPh')}
                  rows={2}
                  className="text-xs resize-none"
                />
                <button
                  type="button"
                  onClick={aiSuggest}
                  disabled={!node.inputUrl || suggesting}
                  className="w-full flex items-center justify-center gap-1.5 text-[11px] font-medium py-1.5 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50 transition-colors"
                >
                  {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {t('studio.aiSuggest')}
                </button>
              </div>
            ) : (
              <InpaintReferenceUpload
                referenceImageDataUrl={node.referenceImageDataUrl}
                onRefChange={(dataUrl, mimeType) => onUpdate({ referenceImageDataUrl: dataUrl, referenceImageMimeType: mimeType })}
                additionalPrompt={node.prompt}
                onAdditionalPromptChange={p => onUpdate({ prompt: p })}
                t={t}
              />
            )}
          </div>
        )}

        {/* Composite node */}
        {node.type === 'composite' && (
          <CompositeNodeConfig
            node={node}
            onUpdate={onUpdate}
            t={t}
          />
        )}

        {/* Enhance node */}
        {node.type === 'enhance' && (
          <p className="text-xs text-muted-foreground py-1">{t('studio.enhanceNote')}</p>
        )}

        {/* BG Remove node */}
        {node.type === 'bg-remove' && (
          <p className="text-xs text-muted-foreground py-1">{t('studio.bgRemoveNote')}</p>
        )}

        {/* Video node */}
        {node.type === 'video' && (
          <div className="space-y-2">
            <Textarea
              value={node.prompt}
              onChange={e => onUpdate({ prompt: e.target.value })}
              placeholder={t('studio.videoPromptPh')}
              rows={2}
              className="text-xs resize-none"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground mb-1">{t('studio.duration')}</p>
                <select
                  value={node.videoDuration}
                  onChange={e => onUpdate({ videoDuration: e.target.value })}
                  className="w-full text-xs border rounded-md px-2 py-1 bg-background"
                >
                  <option value="5">5s</option>
                  <option value="10">10s</option>
                </select>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground mb-1">{t('studio.aspect')}</p>
                <select
                  value={node.videoAspect}
                  onChange={e => onUpdate({ videoAspect: e.target.value })}
                  className="w-full text-xs border rounded-md px-2 py-1 bg-background"
                >
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                  <option value="1:1">1:1</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {node.status === 'error' && node.error && (
          <p className="text-xs text-red-500 mt-1.5 leading-relaxed">{node.error}</p>
        )}

        {/* Run button for non-input nodes */}
        {node.type !== 'input' && (
          <Button
            size="sm"
            onClick={onRun}
            disabled={
              node.status === 'processing' ||
              !node.inputUrl ||
              (node.type === 'inpaint' && !node.maskDataUrl) ||
              (node.type === 'inpaint' && node.inpaintMode === 'text' && !node.prompt.trim()) ||
              (node.type === 'inpaint' && node.inpaintMode === 'reference' && !node.referenceImageDataUrl) ||
              (node.type === 'composite' && !node.maskDataUrl) ||
              (node.type === 'composite' && (!node.sourceBImageDataUrl || !node.sourceBMaskDataUrl))
            }
            className="w-full mt-2 h-7 text-xs gap-1.5"
            variant={node.status === 'done' ? 'outline' : 'default'}
          >
            {node.status === 'processing' ? (
              <><Loader2 className="h-3 w-3 animate-spin" />{t('studio.processing')}</>
            ) : node.status === 'done' ? (
              <><RefreshCw className="h-3 w-3" />{t('studio.rerun')}</>
            ) : (
              <><Sparkles className="h-3 w-3" />{t('studio.run')}</>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Mask Canvas ───────────────────────────────────────────────────────────────

interface MaskCanvasProps {
  imageUrl: string | null
  maskDataUrl: string | null
  onMaskChange: (dataUrl: string | null) => void
  t: ReturnType<typeof useTranslations<'Marketing'>>
  hintOverride?: string
  noImageKey?: string
}

function MaskCanvas({ imageUrl, maskDataUrl, onMaskChange, t, hintOverride, noImageKey }: MaskCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<HTMLCanvasElement | null>(null)   // offscreen: white strokes on transparent
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(24)
  const [mode, setMode] = useState<'draw' | 'erase'>('draw')
  const [hasMask, setHasMask] = useState(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  const ensureMaskCanvas = (w: number, h: number) => {
    let m = maskRef.current
    if (!m) { m = document.createElement('canvas'); maskRef.current = m }
    if (m.width !== w || m.height !== h) { m.width = w; m.height = h }
    return m
  }

  // Draw image + semi-transparent mask overlay when imageUrl changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageUrl) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // reset offscreen mask to the same size, fully transparent
      const m = ensureMaskCanvas(canvas.width, canvas.height)
      m.getContext('2d')?.clearRect(0, 0, m.width, m.height)
      setHasMask(false)
    }
    img.src = imageUrl
  }, [imageUrl])

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const drawStroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // 1) visible red overlay on the display canvas
    ctx.globalCompositeOperation = mode === 'draw' ? 'source-over' : 'destination-out'
    ctx.strokeStyle = 'rgba(255,80,80,0.6)'
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    // 2) authoritative white-on-transparent stroke on the offscreen mask canvas
    const m = ensureMaskCanvas(canvas.width, canvas.height)
    const mCtx = m.getContext('2d')
    if (mCtx) {
      mCtx.globalCompositeOperation = mode === 'draw' ? 'source-over' : 'destination-out'
      mCtx.strokeStyle = '#ffffff'
      mCtx.lineWidth = brushSize
      mCtx.lineCap = 'round'
      mCtx.lineJoin = 'round'
      mCtx.beginPath()
      mCtx.moveTo(from.x, from.y)
      mCtx.lineTo(to.x, to.y)
      mCtx.stroke()
    }
    if (mode === 'draw') setHasMask(true)
    exportMask()
  }

  const exportMask = () => {
    const canvas = canvasRef.current
    const m = maskRef.current
    if (!canvas || !m) return
    // Composite the white strokes over a solid black background → black/white mask
    const out = document.createElement('canvas')
    out.width = canvas.width
    out.height = canvas.height
    const oCtx = out.getContext('2d')
    if (!oCtx) return
    oCtx.fillStyle = 'black'
    oCtx.fillRect(0, 0, out.width, out.height)
    oCtx.drawImage(m, 0, 0)
    onMaskChange(out.toDataURL('image/png'))
  }

  const clearMask = () => {
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    const m = maskRef.current
    if (m) m.getContext('2d')?.clearRect(0, 0, m.width, m.height)
    setHasMask(false)
    onMaskChange(null)
  }

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e)
    if (!pos) return
    setIsDrawing(true)
    lastPos.current = pos
    drawStroke(pos, pos)
  }
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const pos = getPos(e)
    if (!pos || !lastPos.current) return
    drawStroke(lastPos.current, pos)
    lastPos.current = pos
  }
  const onMouseUp = () => { setIsDrawing(false); lastPos.current = null }

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const pos = getPos(e)
    if (!pos) return
    setIsDrawing(true)
    lastPos.current = pos
    drawStroke(pos, pos)
  }
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawing) return
    const pos = getPos(e)
    if (!pos || !lastPos.current) return
    drawStroke(lastPos.current, pos)
    lastPos.current = pos
  }

  if (!imageUrl) {
    return (
      <div className="text-xs text-muted-foreground py-2 text-center border border-dashed rounded-lg">
        {noImageKey ? t(noImageKey as Parameters<typeof t>[0]) : t('studio.inpaintNoImage')}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-muted-foreground">{hintOverride ?? t('studio.inpaintHint')}</p>
        {hasMask && (
          <button onClick={clearMask} className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700">
            <Trash2 className="h-2.5 w-2.5" />{t('studio.inpaintClear')}
          </button>
        )}
      </div>

      {/* Brush toolbar */}
      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2 py-1.5">
        <button
          onClick={() => setMode('draw')}
          className={cn('flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-medium transition-colors',
            mode === 'draw' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' : 'text-muted-foreground hover:text-foreground')}
        >
          <Brush className="h-3 w-3" />{t('studio.inpaintDraw')}
        </button>
        <button
          onClick={() => setMode('erase')}
          className={cn('flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-medium transition-colors',
            mode === 'erase' ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' : 'text-muted-foreground hover:text-foreground')}
        >
          <Eraser className="h-3 w-3" />{t('studio.inpaintErase')}
        </button>
        <div className="flex-1 flex items-center gap-1.5 ml-1">
          <span className="text-[9px] text-muted-foreground shrink-0">{t('studio.inpaintBrush')}</span>
          <input
            type="range" min={8} max={80} step={4}
            value={brushSize}
            onChange={e => setBrushSize(parseInt(e.target.value))}
            className="flex-1 h-1 accent-rose-500"
          />
        </div>
      </div>

      {/* Canvas overlay */}
      <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden border border-border cursor-crosshair"
        style={{ touchAction: 'none' }}
      >
        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="base" className="w-full block pointer-events-none select-none" />
        {/* Paint canvas (transparent background, red overlay) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ mixBlendMode: 'multiply' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onMouseUp}
        />
        {!hasMask && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 text-white text-[10px] px-3 py-1.5 rounded-full font-medium">
              {t('studio.inpaintPaintHint')}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Composite Node Config ────────────────────────────────────────────────────

interface CompositeNodeConfigProps {
  node: PipelineNode
  onUpdate: (patch: Partial<PipelineNode>) => void
  t: ReturnType<typeof useTranslations<'Marketing'>>
}

function CompositeNodeConfig({ node, onUpdate, t }: CompositeNodeConfigProps) {
  const bFileRef = useRef<HTMLInputElement>(null)

  const handleBUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const mime = file.type
    const reader = new FileReader()
    reader.onload = ev => onUpdate({ sourceBImageDataUrl: ev.target?.result as string, sourceBImageMimeType: mime, sourceBMaskDataUrl: null })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-3">
      {/* Step 1: Paint destination on A */}
      <div>
        <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-1">{t('studio.composite.maskALabel')}</p>
        <MaskCanvas
          imageUrl={node.inputUrl}
          maskDataUrl={node.maskDataUrl}
          onMaskChange={maskDataUrl => onUpdate({ maskDataUrl })}
          t={t}
          hintOverride={t('studio.composite.maskAHint')}
          noImageKey="studio.composite.noAImageYet"
        />
      </div>

      {/* Step 2: Upload B */}
      <div>
        <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-1">{t('studio.composite.uploadBLabel')}</p>
        <div
          onClick={() => bFileRef.current?.click()}
          className={cn(
            'relative border-2 border-dashed rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5',
            node.sourceBImageDataUrl ? 'border-amber-300 p-1' : 'border-border hover:border-amber-400 p-3',
          )}
        >
          {node.sourceBImageDataUrl ? (
            <div className="relative w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={node.sourceBImageDataUrl} alt="source B" className="w-full max-h-28 object-contain rounded-lg" />
              <button
                onClick={e => { e.stopPropagation(); onUpdate({ sourceBImageDataUrl: null, sourceBImageMimeType: null, sourceBMaskDataUrl: null }) }}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="h-4 w-4 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground text-center">{t('studio.composite.uploadBHint')}</p>
            </>
          )}
        </div>
        <input ref={bFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBUpload} />
      </div>

      {/* Step 3: Paint source area on B */}
      {node.sourceBImageDataUrl && (
        <div>
          <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-1">{t('studio.composite.maskBLabel')}</p>
          <MaskCanvas
            imageUrl={node.sourceBImageDataUrl}
            maskDataUrl={node.sourceBMaskDataUrl}
            onMaskChange={sourceBMaskDataUrl => onUpdate({ sourceBMaskDataUrl })}
            t={t}
            hintOverride={t('studio.composite.maskBHint')}
            noImageKey="studio.composite.noBImageYet"
          />
        </div>
      )}

      {/* Optional blend prompt */}
      <div>
        <p className="text-[10px] text-muted-foreground mb-1">{t('studio.composite.blendPrompt')}</p>
        <Textarea
          value={node.compositePrompt}
          onChange={e => onUpdate({ compositePrompt: e.target.value })}
          placeholder={t('studio.composite.blendPromptPh')}
          rows={2}
          className="text-xs resize-none"
        />
      </div>
    </div>
  )
}

// ─── Inpaint Reference Image Uploader ─────────────────────────────────────────

interface InpaintReferenceUploadProps {
  referenceImageDataUrl: string | null
  onRefChange: (dataUrl: string | null, mimeType: string | null) => void
  additionalPrompt: string
  onAdditionalPromptChange: (p: string) => void
  t: ReturnType<typeof useTranslations<'Marketing'>>
}

function InpaintReferenceUpload({
  referenceImageDataUrl, onRefChange, additionalPrompt, onAdditionalPromptChange, t,
}: InpaintReferenceUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const mime = file.type
    const reader = new FileReader()
    reader.onload = ev => onRefChange(ev.target?.result as string, mime)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => fileRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5',
          referenceImageDataUrl ? 'border-rose-300 p-1' : 'border-border hover:border-rose-300 p-4',
        )}
      >
        {referenceImageDataUrl ? (
          <div className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={referenceImageDataUrl} alt="reference" className="w-full max-h-32 object-contain rounded-lg" />
            <button
              onClick={e => { e.stopPropagation(); onRefChange(null, null) }}
              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground text-center">{t('studio.inpaintRefHint')}</p>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />

      <div>
        <p className="text-[10px] text-muted-foreground mb-1">{t('studio.inpaintRefExtra')}</p>
        <Textarea
          value={additionalPrompt}
          onChange={e => onAdditionalPromptChange(e.target.value)}
          placeholder={t('studio.inpaintRefExtraPh')}
          rows={1}
          className="text-xs resize-none"
        />
      </div>
    </div>
  )
}
