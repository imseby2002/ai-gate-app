'use client'

import { useState } from 'react'
import { Loader2, Download, Wand2 } from 'lucide-react'

export const runtime = 'edge'

const IMAGE_MODELS = [
  { id: 'flux-1-pro', name: 'FLUX.1 Pro', desc: '高品質寫實風格', cost: '$0.05/張' },
  { id: 'nano-banana', name: 'Nano Banana', desc: '快速生成、多風格', cost: '$0.02/張' },
]

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4']

export default function ImageGenPage() {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('flux-1-pro')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model, aspectRatio }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.imageUrl) setImages(prev => [data.imageUrl, ...prev])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">圖片生成</h1>
        <p className="text-gray-500 text-sm mt-1">使用 FLUX 或 Nano Banana 從文字生成圖片</p>
      </div>

      <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-5">
        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">選擇模型</label>
          <div className="grid grid-cols-2 gap-3">
            {IMAGE_MODELS.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModel(m.id)}
                className="p-4 rounded-xl border-2 text-left transition-all"
                style={model === m.id ? {
                  borderColor: 'var(--primary)',
                  background: 'color-mix(in oklch, var(--primary) 5%, transparent)'
                } : {}}
              >
                <div className="font-medium text-sm">{m.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>
                <div className="text-xs font-medium mt-1" style={{ color: 'var(--primary)' }}>{m.cost}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Aspect Ratio */}
        <div>
          <label className="block text-sm font-medium mb-2">長寬比</label>
          <div className="flex flex-wrap gap-2">
            {ASPECT_RATIOS.map(ratio => (
              <button
                key={ratio}
                type="button"
                onClick={() => setAspectRatio(ratio)}
                className="px-3 py-1.5 rounded-lg border text-sm transition-all"
                style={aspectRatio === ratio ? {
                  borderColor: 'var(--primary)',
                  background: 'color-mix(in oklch, var(--primary) 10%, transparent)',
                  color: 'var(--primary)'
                } : {}}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt */}
        <div>
          <label className="block text-sm font-medium mb-2">描述提示詞</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
            placeholder="描述你想生成的圖片...&#10;例如：A professional business team meeting in a modern office, photorealistic, 8k"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
          style={{ background: 'var(--primary)' }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {loading ? '生成中...' : '生成圖片'}
        </button>
      </div>

      {/* Generated Images */}
      {images.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">生成結果</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((url, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden border shadow-sm">
                <img src={url} alt={`Generated ${i + 1}`} className="w-full object-cover" />
                <a
                  href={url}
                  download
                  className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  <Download className="h-8 w-8 text-white drop-shadow" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
