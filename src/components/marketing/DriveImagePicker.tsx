'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { FolderOpen, RefreshCw, Upload, Link, ExternalLink, X, Image as ImageIcon, Loader2, Building2, Package, Palette, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface DriveFolder { id: string; name: string }
interface PickedImage {
  fileId: string
  name: string
  dataUrl: string
  publicUrl: string
  mimeType: string
}

interface CompanyAsset {
  id: string
  url: string
  name: string
  category: 'store' | 'product' | 'brand'
  subGroup?: string
}

interface Props {
  folderId?: string
  folderName?: string
  onFolderChange: (id: string, name: string) => void
  onImagePicked: (img: PickedImage | null) => void
  pickedImage: PickedImage | null
  label?: string
}

async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return url
  }
}

export default function DriveImagePicker({
  folderId,
  folderName,
  onFolderChange,
  onImagePicked,
  pickedImage,
  label,
}: Props) {
  const t = useTranslations('DrivePicker')
  const [sourceMode, setSourceMode] = useState<'company' | 'upload' | 'drive'>('company')

  // Company assets state
  const [companyAssets, setCompanyAssets] = useState<CompanyAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [assetFilter, setAssetFilter] = useState<'all' | 'store' | 'product' | 'brand'>('all')

  // Google Drive state
  const [connected, setConnected] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [folders, setFolders] = useState<DriveFolder[]>([])
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [showFolderPicker, setShowFolderPicker] = useState(false)

  // General loading & error
  const [loadingImage, setLoadingImage] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load company assets
  useEffect(() => {
    setLoadingAssets(true)
    fetch('/api/marketing/company-assets')
      .then(r => r.json())
      .then(d => {
        if (d.assets) setCompanyAssets(d.assets)
      })
      .catch(() => {})
      .finally(() => setLoadingAssets(false))
  }, [])

  // Check Google Drive connection status
  useEffect(() => {
    fetch('/api/integrations/google-drive/status')
      .then(r => r.json())
      .then(d => { setConnected(d.connected); setEmail(d.email ?? '') })
      .catch(() => setConnected(false))
  }, [])

  const handleSelectCompanyAsset = async (asset: CompanyAsset) => {
    setLoadingImage(true)
    setError('')
    try {
      const dataUrl = await urlToDataUrl(asset.url)
      onImagePicked({
        fileId: asset.id,
        name: asset.name,
        dataUrl,
        publicUrl: asset.url,
        mimeType: 'image/jpeg',
      })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoadingImage(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file hình ảnh (JPG, PNG, WebP)')
      return
    }
    setLoadingImage(true)
    setError('')
    try {
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      let publicUrl = dataUrl
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('category', 'image')
        const res = await fetch('/api/marketing/upload-file', {
          method: 'POST',
          body: form,
        })
        if (res.ok) {
          const data = await res.json()
          if (data.url) publicUrl = data.url
        }
      } catch {
        // Fallback to dataUrl
      }

      onImagePicked({
        fileId: `upload_${Date.now()}`,
        name: file.name,
        dataUrl,
        publicUrl,
        mimeType: file.type || 'image/jpeg',
      })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true)
    setError('')
    try {
      const res = await fetch('/api/integrations/google-drive/folders')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFolders(data.folders)
      setShowFolderPicker(true)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoadingFolders(false)
    }
  }, [])

  const pickRandomImage = useCallback(async (folId: string) => {
    if (!folId) return
    setLoadingImage(true)
    setError('')
    onImagePicked(null)
    try {
      const res = await fetch('/api/integrations/google-drive/random-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: folId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onImagePicked({ fileId: data.fileId, name: data.name, dataUrl: data.dataUrl, publicUrl: data.publicUrl, mimeType: data.mimeType })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoadingImage(false)
    }
  }, [onImagePicked])

  const filteredAssets = companyAssets.filter(a => {
    if (assetFilter === 'all') return true
    return a.category === assetFilter
  })

  return (
    <div className="space-y-3">
      {/* Header & Source Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-gray-500" />
          {label ?? t('refImage')}
        </span>
        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setSourceMode('company')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              sourceMode === 'company'
                ? 'bg-white text-gray-900 shadow-sm font-semibold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Building2 className="w-3 h-3 text-indigo-600" />
            {t('companyAssets')}
            {companyAssets.length > 0 && (
              <span className="ml-1 text-[9px] bg-indigo-100 text-indigo-700 px-1 py-0.2 rounded-full font-bold">
                {companyAssets.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSourceMode('upload')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              sourceMode === 'upload'
                ? 'bg-white text-gray-900 shadow-sm font-semibold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Upload className="w-3 h-3 text-blue-600" />
            {t('directUpload')}
          </button>
          <button
            type="button"
            onClick={() => setSourceMode('drive')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              sourceMode === 'drive'
                ? 'bg-white text-gray-900 shadow-sm font-semibold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <FolderOpen className="w-3 h-3 text-amber-500" />
            {t('fromDrive')}
          </button>
        </div>
      </div>

      {/* Mode 1: Company Asset Library (門市、產品、品牌) */}
      {sourceMode === 'company' && (
        <div className="space-y-2 p-3 bg-white rounded-xl border">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pb-1 border-b">
            <button
              type="button"
              onClick={() => setAssetFilter('all')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                assetFilter === 'all'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('allAssets')} ({companyAssets.length})
            </button>
            <button
              type="button"
              onClick={() => setAssetFilter('store')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                assetFilter === 'store'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Building2 className="w-2.5 h-2.5" />
              {t('storePhotos')} ({companyAssets.filter(a => a.category === 'store').length})
            </button>
            <button
              type="button"
              onClick={() => setAssetFilter('product')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                assetFilter === 'product'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Package className="w-2.5 h-2.5" />
              {t('productPhotos')} ({companyAssets.filter(a => a.category === 'product').length})
            </button>
            <button
              type="button"
              onClick={() => setAssetFilter('brand')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                assetFilter === 'brand'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Palette className="w-2.5 h-2.5" />
              {t('brandAssets')} ({companyAssets.filter(a => a.category === 'brand').length})
            </button>
          </div>

          {/* Photo Grid */}
          {loadingAssets ? (
            <div className="flex items-center justify-center py-6 gap-2 text-xs text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              {t('loadingAssets')}
            </div>
          ) : filteredAssets.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-56 overflow-y-auto p-1">
              {filteredAssets.map(asset => {
                const isSelected = pickedImage?.fileId === asset.id || pickedImage?.publicUrl === asset.url
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => handleSelectCompanyAsset(asset)}
                    className={`group relative rounded-lg overflow-hidden border-2 transition-all aspect-square bg-gray-50 text-left ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-200'
                        : 'border-transparent hover:border-indigo-300'
                    }`}
                  >
                    <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                    {asset.subGroup && (
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs text-[9px] text-white px-1 py-0.5 truncate font-medium">
                        {asset.subGroup}
                      </span>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-white drop-shadow" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="py-6 px-4 text-center space-y-2">
              <p className="text-xs text-gray-500">{t('noCompanyAssets')}</p>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setSourceMode('upload')}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                >
                  <Upload className="w-3 h-3" />
                  {t('directUpload')}
                </button>
                <a
                  href="/marketing/brand"
                  target="_blank"
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg border text-gray-600 hover:bg-gray-50"
                >
                  前往維護公司資料 ↗
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Direct File Upload */}
      {sourceMode === 'upload' && (
        <div className="space-y-2">
          {!pickedImage ? (
            <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 hover:border-blue-400 bg-white hover:bg-blue-50/20 rounded-xl cursor-pointer transition-all group">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                disabled={loadingImage}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleFileUpload(f)
                }}
              />
              {loadingImage ? (
                <div className="flex flex-col items-center gap-1.5 py-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="text-xs text-gray-500 font-medium">{t('uploading')}</span>
                </div>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center mb-2 transition-colors">
                    <Upload className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 group-hover:text-blue-600">{t('uploadHint')}</span>
                  <span className="text-[10px] text-gray-400 mt-0.5">PNG, JPG, WebP · Max 15MB</span>
                </>
              )}
            </label>
          ) : (
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  className="hidden"
                  disabled={loadingImage}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleFileUpload(f)
                  }}
                />
                <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  {t('another')}
                </span>
              </label>
              <button
                type="button"
                onClick={() => onImagePicked(null)}
                className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> {t('clearImage')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mode 3: Google Drive */}
      {sourceMode === 'drive' && (
        <div className="space-y-2">
          {connected === null ? (
            <div className="text-xs text-gray-400 animate-pulse">{t('checking')}</div>
          ) : !connected ? (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-gray-300 bg-gray-50">
              <Link className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500">{t('notConnected')}</span>
              <a
                href="/api/integrations/google-drive/auth"
                className="ml-auto text-xs font-medium text-blue-600 hover:underline flex items-center gap-1"
              >
                {t('goConnect')} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                  Google Drive: {email}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadFolders}
                  disabled={loadingFolders}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                  {folderId ? folderName ?? t('folderPicked') : t('pickFolder')}
                </button>
                {folderId && (
                  <button
                    type="button"
                    onClick={() => pickRandomImage(folderId)}
                    disabled={loadingImage}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingImage ? 'animate-spin' : ''}`} />
                    {loadingImage ? t('fetching') : t('randomPick')}
                  </button>
                )}
              </div>

              {/* Folder list dropdown */}
              {showFolderPicker && folders.length > 0 && (
                <div className="border rounded-lg bg-white shadow-sm max-h-40 overflow-y-auto">
                  {folders.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        onFolderChange(f.id, f.name)
                        setShowFolderPicker(false)
                        pickRandomImage(f.id)
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b last:border-0 flex items-center gap-2"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Picked image preview (shared for all sources) */}
      {pickedImage && (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pickedImage.dataUrl} alt={pickedImage.name} className="w-full max-h-52 object-contain bg-slate-900/5" />
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-3 py-1.5 flex items-center justify-between">
            <span className="text-xs text-white truncate max-w-[70%] font-medium">{pickedImage.name}</span>
            <button
              type="button"
              onClick={() => onImagePicked(null)}
              className="text-xs text-white/80 hover:text-white flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors"
            >
              <X className="w-3 h-3" /> {t('clearImage')}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  )
}

