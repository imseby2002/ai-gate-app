'use client'

import { useState } from 'react'
import { Loader2, Video, Play } from 'lucide-react'

const VIDEO_MODELS = [
  { id: 'veo3', name: 'VEO3', desc: 'Google 最新影片生成，高品質寫實', cost: '$0.15/秒' },
  { id: 'kling-v2', name: 'Kling V2', desc: '創意風格影片，多種藝術效果', cost: '$0.10/秒' },
]

const DURATIONS = [
  { value: 5, label: '5 秒' },
  { value: 10, label: '10 秒' },
]

export default function VideoGenPage() {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('veo3')
  const [duration, setDuration] = useState(5)
  const [loading, setLoading] = useState(false)
  const [videos, setVideos] = useState<string[]>([])
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model, duration }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.videoUrl) setVideos(prev => [data.videoUrl, ...prev])
      else setError('影片生成中，請稍後查看結果')
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const selectedModel = VIDEO_MODELS.find(m => m.id === model)
  const estimatedCost = selectedModel ? `~$${(duration * parseFloat(selectedModel.cost.split('$')[1])).toFixed(2)}` : ''

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background px-4 py-4 sm:px-6 sm:py-6 space-y-5 sm:space-y-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold">影片生成</h1>
        <p className="text-muted-foreground text-sm mt-1">使用 VEO3 或 Kling 從文字生成影片</p>
      </div>

      <div className="max-w-3xl mx-auto bg-card rounded-2xl border p-4 sm:p-6 shadow-sm space-y-5">
        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">選擇模型</label>
          <div className="grid grid-cols-2 gap-3">
            {VIDEO_MODELS.map(m => (
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
                <div className="text-xs text-muted-foreground mt-0.5">{m.desc}</div>
                <div className="text-xs font-medium mt-1" style={{ color: 'var(--primary)' }}>{m.cost}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium mb-2">影片長度</label>
          <div className="flex flex-wrap items-center gap-2">
            {DURATIONS.map(d => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDuration(d.value)}
                className="px-4 py-2 rounded-lg border text-sm font-medium transition-all"
                style={duration === d.value ? {
                  borderColor: 'var(--primary)',
                  background: 'color-mix(in oklch, var(--primary) 10%, transparent)',
                  color: 'var(--primary)'
                } : {}}
              >
                {d.label}
              </button>
            ))}
            {estimatedCost && (
              <span className="text-sm text-muted-foreground">
                預估：<span className="font-medium text-foreground">{estimatedCost}</span>
              </span>
            )}
          </div>
        </div>

        {/* Prompt */}
        <div>
          <label className="block text-sm font-medium mb-2">影片描述</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 resize-none bg-background"
            placeholder="描述影片內容...&#10;例如：A cinematic drone shot flying over a futuristic city at sunset, 4K quality"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm text-amber-700 bg-amber-50 border border-amber-200">{error}</div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
          {loading ? '生成中（可能需要數分鐘）...' : '生成影片'}
        </button>
      </div>

      {videos.length > 0 && (
        <div className="max-w-3xl mx-auto">
          <h2 className="font-semibold mb-3">生成結果</h2>
          <div className="space-y-4">
            {videos.map((url, i) => (
              <div key={i} className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <video src={url} controls className="w-full max-h-96" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
