'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Download, Copy, Trash2, Eye, RefreshCw, Loader2,
  Sparkles, Image as ImageIcon, Video, ExternalLink, ArrowRight,
  Check, AlertCircle, FolderArchive, Play
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserAssetItem } from '@/app/api/marketing/assets/route'

export interface MarketingAssetArchiveModalProps {
  open: boolean
  onClose: () => void
  onSelectImage?: (url: string) => void
  selectButtonText?: string
}

export function MarketingAssetArchiveModal({
  open,
  onClose,
  onSelectImage,
  selectButtonText = '載入至工作台'
}: MarketingAssetArchiveModalProps) {
  const [mounted, setMounted] = useState(false)
  const [assets, setAssets] = useState<UserAssetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'studio' | 'template' | 'video'>('all')
  const [previewAsset, setPreviewAsset] = useState<UserAssetItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/marketing/assets')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '無法取得封存素材列表')
      setAssets(data.assets || [])
    } catch (err: any) {
      setError(err.message || '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchAssets()
    }
  }, [open, fetchAssets])

  const filteredAssets = useMemo(() => {
    if (activeTab === 'all') return assets
    if (activeTab === 'studio') return assets.filter(a => a.type === 'studio')
    if (activeTab === 'template') return assets.filter(a => a.type === 'template' || a.type === 'img')
    if (activeTab === 'video') return assets.filter(a => a.type === 'video' || a.isVideo)
    return assets
  }, [assets, activeTab])

  const handleCopyLink = (asset: UserAssetItem) => {
    navigator.clipboard.writeText(asset.url)
    setCopiedId(asset.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (asset: UserAssetItem) => {
    if (!confirm('確定要從雲端封存區刪除此檔案嗎？')) return
    setDeletingId(asset.id)
    try {
      const res = await fetch('/api/marketing/assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: asset.name }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '刪除失敗')
      }
      setAssets(prev => prev.filter(a => a.id !== asset.id))
      if (previewAsset?.id === asset.id) setPreviewAsset(null)
    } catch (err: any) {
      alert(err.message || '刪除失敗')
    } finally {
      setDeletingId(null)
    }
  }

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleString('zh-TW', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  if (!mounted || !open) return null

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-card w-full max-w-4xl max-h-[90vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FolderArchive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                行銷作品雲端封存區
                <Badge variant="outline" className="text-xs font-normal">
                  永久雲端自動備份
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                所有修改設計、風格模板與生成影片皆已自動安全儲存，可隨時在此下載或載入
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAssets}
              disabled={loading}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              title="重新整理"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-6 py-2.5 border-b bg-muted/10 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'all', label: '全部作品' },
              { id: 'studio', label: '視覺工坊設計' },
              { id: 'template', label: '風格模板' },
              { id: 'video', label: 'AI 影片' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            共 {filteredAssets.length} 項作品
          </span>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-[300px]">
          {loading && assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs">正在從雲端載入您的作品封存庫…</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <ImageIcon className="h-12 w-12 stroke-1 mb-2 opacity-40" />
              <p className="font-semibold text-sm text-foreground">目前封存區尚無此類作品</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                在「AI 視覺工坊」或「行銷風格模板」中產出之設計修改與影片，均會自動在此封存備份。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredAssets.map(asset => (
                <div
                  key={asset.id}
                  className="group relative rounded-xl border bg-card overflow-hidden hover:shadow-md transition-all flex flex-col justify-between"
                >
                  {/* Media Preview Box */}
                  <div
                    onClick={() => setPreviewAsset(asset)}
                    className="relative aspect-square w-full bg-slate-900 overflow-hidden cursor-pointer flex items-center justify-center"
                  >
                    {asset.isVideo ? (
                      <>
                        <video src={asset.url} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Play className="h-8 w-8 text-white fill-white/80" />
                        </div>
                      </>
                    ) : (
                      <img
                        src={asset.url}
                        alt={asset.typeLabel}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    )}

                    {/* Type badge overlay */}
                    <div className="absolute top-2 left-2">
                      <Badge className="text-[10px] px-1.5 py-0 bg-black/70 text-white backdrop-blur-xs font-semibold border-0">
                        {asset.typeLabel}
                      </Badge>
                    </div>

                    {/* Hover actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 w-8 p-0 rounded-full bg-white/90 text-black hover:bg-white"
                        title="點擊放大預覽"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <a
                        href={asset.url}
                        download={asset.name}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="h-8 w-8 rounded-full bg-white/90 text-black hover:bg-white flex items-center justify-center transition-colors"
                        title="下載原檔"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  </div>

                  {/* Info bottom */}
                  <div className="p-2.5 space-y-1.5 border-t bg-card text-xs">
                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span>{formatTime(asset.createdAt)}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopyLink(asset)}
                          className="p-1 hover:text-foreground rounded transition-colors"
                          title="複製連結"
                        >
                          {copiedId === asset.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => handleDelete(asset)}
                          disabled={deletingId === asset.id}
                          className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                          title="刪除"
                        >
                          {deletingId === asset.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>

                    {onSelectImage && !asset.isVideo && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onSelectImage(asset.url)
                          onClose()
                        }}
                        className="w-full h-7 text-[11px] gap-1 font-semibold hover:bg-primary hover:text-primary-foreground border-primary/40 text-primary"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>{selectButtonText}</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
          <span>提示：在此下載或複製網址皆可永久直接使用。</span>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs font-semibold">
            關閉
          </Button>
        </div>
      </div>

      {/* Full Preview Modal */}
      {previewAsset && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setPreviewAsset(null)}
        >
          <div
            className="max-w-3xl max-h-[90vh] bg-card rounded-2xl border shadow-2xl p-4 flex flex-col gap-3 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-semibold">{previewAsset.typeLabel}</Badge>
                <span className="text-xs text-muted-foreground">{formatTime(previewAsset.createdAt)}</span>
              </div>
              <button onClick={() => setPreviewAsset(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-center max-h-[65vh] overflow-hidden bg-black/90 rounded-xl">
              {previewAsset.isVideo ? (
                <video src={previewAsset.url} controls autoPlay className="max-h-[65vh] w-auto rounded-lg" />
              ) : (
                <img src={previewAsset.url} alt="" className="max-h-[65vh] w-auto object-contain rounded-lg" />
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyLink(previewAsset)}
                className="gap-1.5 text-xs h-8"
              >
                {copiedId === previewAsset.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedId === previewAsset.id ? '已複製連結' : '複製公開連結'}
              </Button>

              <div className="flex items-center gap-2">
                {onSelectImage && !previewAsset.isVideo && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onSelectImage(previewAsset.url)
                      setPreviewAsset(null)
                      onClose()
                    }}
                    className="gap-1.5 text-xs h-8 font-semibold bg-gradient-to-r from-violet-600 to-pink-600 text-white"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {selectButtonText}
                  </Button>
                )}
                <a href={previewAsset.url} download={previewAsset.name} target="_blank" rel="noreferrer">
                  <Button size="sm" className="gap-1.5 text-xs h-8 font-semibold">
                    <Download className="h-3.5 w-3.5" />
                    下載高畫質原檔
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(modalContent, document.body)
}
