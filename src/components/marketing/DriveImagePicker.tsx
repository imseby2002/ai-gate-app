'use client'
import { useState, useEffect, useCallback } from 'react'
import { FolderOpen, RefreshCw, Image, Link, ExternalLink } from 'lucide-react'

interface DriveFolder { id: string; name: string }
interface PickedImage {
  fileId: string
  name: string
  dataUrl: string
  publicUrl: string
  mimeType: string
}

interface Props {
  folderId?: string
  folderName?: string
  onFolderChange: (id: string, name: string) => void
  onImagePicked: (img: PickedImage | null) => void
  pickedImage: PickedImage | null
  label?: string
}

export default function DriveImagePicker({
  folderId,
  folderName,
  onFolderChange,
  onImagePicked,
  pickedImage,
  label = '參考圖片',
}: Props) {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [folders, setFolders] = useState<DriveFolder[]>([])
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [loadingImage, setLoadingImage] = useState(false)
  const [error, setError] = useState('')
  const [showFolderPicker, setShowFolderPicker] = useState(false)

  // Check connection status
  useEffect(() => {
    fetch('/api/integrations/google-drive/status')
      .then(r => r.json())
      .then(d => { setConnected(d.connected); setEmail(d.email ?? '') })
      .catch(() => setConnected(false))
  }, [])

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

  if (connected === null) return <div className="text-xs text-gray-400 animate-pulse">檢查 Google Drive 連接狀態…</div>

  if (!connected) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <Link className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="text-xs text-gray-500">尚未連接 Google Drive</span>
        <a
          href="/api/integrations/google-drive/auth"
          className="ml-auto text-xs font-medium text-blue-600 hover:underline flex items-center gap-1"
        >
          前往設定連接 <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{email}</span>
      </div>

      {/* Folder selector */}
      <div className="flex items-center gap-2">
        <button
          onClick={loadFolders}
          disabled={loadingFolders}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          {folderId ? folderName ?? '已選資料夾' : '選擇資料夾'}
        </button>
        {folderId && (
          <button
            onClick={() => pickRandomImage(folderId)}
            disabled={loadingImage}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingImage ? 'animate-spin' : ''}`} />
            {loadingImage ? '取圖中…' : '隨機取圖'}
          </button>
        )}
      </div>

      {/* Folder list dropdown */}
      {showFolderPicker && folders.length > 0 && (
        <div className="border rounded-lg bg-white shadow-sm max-h-40 overflow-y-auto">
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => {
                onFolderChange(f.id, f.name)
                setShowFolderPicker(false)
                pickRandomImage(f.id)
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b last:border-0 flex items-center gap-2"
            >
              <FolderOpen className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
              {f.name}
            </button>
          ))}
        </div>
      )}

      {/* Picked image preview */}
      {pickedImage && (
        <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pickedImage.dataUrl} alt={pickedImage.name} className="w-full max-h-48 object-contain" />
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 flex items-center justify-between">
            <span className="text-xs text-white truncate">{pickedImage.name}</span>
            <button
              onClick={() => pickRandomImage(folderId!)}
              disabled={loadingImage}
              className="text-xs text-white/80 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> 換一張
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
