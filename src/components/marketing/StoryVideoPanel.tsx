'use client'

/**
 * 多分鏡配音影片：主題／內容 → AI 分鏡（旁白＋畫面）→ 每段產圖＋配音 → worker 套版型、字幕、背景音樂合成
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Clapperboard, Loader2, Sparkles, Trash2, Plus, Download } from 'lucide-react'

interface Scene { narration: string; visualPrompt: string }
interface RenderJob {
  id: string
  status: 'queued' | 'rendering' | 'done' | 'failed'
  title: string | null
  scenes: { narration: string }[]
  output_url: string | null
  duration_sec: number | null
  error: string | null
  created_at: string
}

const VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', descKey: 'mlFemale' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', descKey: 'mlMale' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', descKey: 'mlFemale' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', descKey: 'brMale' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', descKey: 'mlFemale' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', descKey: 'usFemale' },
]
const TEMPLATES = ['classic', 'fullbleed', 'card'] as const
const ASPECTS = ['9:16', '16:9', '1:1'] as const

export function StoryVideoPanel({ defaultContent = '', language }: { defaultContent?: string; language?: string }) {
  const t = useTranslations('MA')
  const [content, setContent] = useState(defaultContent)
  const [mode, setMode] = useState<'topic' | 'content'>(defaultContent ? 'content' : 'topic')
  const [sceneCount, setSceneCount] = useState(5)
  const [style, setStyle] = useState('')
  const [title, setTitle] = useState('')
  const [scenes, setScenes] = useState<Scene[]>([])
  const [voiceId, setVoiceId] = useState(VOICES[0].id)
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]>('classic')
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>('9:16')
  const [bgm, setBgm] = useState(true)
  const [busy, setBusy] = useState<'script' | 'render' | null>(null)
  const [error, setError] = useState('')
  const [jobs, setJobs] = useState<RenderJob[]>([])
  const [enabled, setEnabled] = useState(false)

  useEffect(() => { if (defaultContent && !content) setContent(defaultContent) }, [defaultContent, content])

  const loadJobs = useCallback(async () => {
    const res = await fetch('/api/marketing/video-render')
    if (!res.ok) return
    const data = await res.json()
    setEnabled(data.enabled === true)
    setJobs(data.jobs ?? [])
  }, [])
  useEffect(() => { loadJobs() }, [loadJobs])

  // 有進行中的任務就每 8 秒更新一次
  const pending = jobs.some(j => j.status === 'queued' || j.status === 'rendering')
  useEffect(() => {
    if (!pending) return
    const timer = setInterval(loadJobs, 8000)
    return () => clearInterval(timer)
  }, [pending, loadJobs])

  const genScript = async () => {
    if (!content.trim()) { setError(t('story.errContent')); return }
    setBusy('script'); setError('')
    try {
      const res = await fetch('/api/marketing/video-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, mode, sceneCount, style, language }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setTitle(data.title ?? '')
      setScenes(data.scenes ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const startRender = async () => {
    setBusy('render'); setError('')
    try {
      const res = await fetch('/api/marketing/video-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, scenes, voiceId, template, aspect, bgm }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setJobs(prev => [data.job, ...prev])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const updateScene = (i: number, patch: Partial<Scene>) =>
    setScenes(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))

  if (!enabled) return null

  const input = 'w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 bg-white'

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold text-sm">
          <Clapperboard className="h-4 w-4 text-indigo-600" /> {t('story.title')}
        </h3>
        <p className="text-xs text-gray-500 mt-1">{t('story.desc')}</p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 text-xs">
          {(['topic', 'content'] as const).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg border ${mode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white'}`}>
              {t(`story.mode.${m}`)}
            </button>
          ))}
        </div>
        <textarea rows={4} value={content} onChange={e => setContent(e.target.value)}
          placeholder={t(`story.placeholder.${mode}`)} className={input} />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1">{t('story.sceneCount')}
            <select value={sceneCount} onChange={e => setSceneCount(Number(e.target.value))} className="h-8 px-2 rounded-lg border bg-white">
              {[3, 4, 5, 6, 7, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <input value={style} onChange={e => setStyle(e.target.value)} placeholder={t('story.stylePlaceholder')}
            className="h-8 px-2 rounded-lg border bg-white flex-1 min-w-[180px]" />
          <button type="button" onClick={genScript} disabled={busy !== null}
            className="h-8 px-3 rounded-lg bg-indigo-600 text-white flex items-center gap-1 disabled:opacity-50">
            {busy === 'script' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {t('story.genScript')}
          </button>
        </div>
      </div>

      {scenes.length > 0 && (
        <div className="space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('story.videoTitle')} className={input} />
          {scenes.map((s, i) => (
            <div key={i} className="rounded-xl border bg-white p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-gray-500">
                {t('story.scene', { n: i + 1 })}
                <button type="button" onClick={() => setScenes(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-gray-400 hover:text-red-500" aria-label={t('story.removeScene')}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea rows={2} value={s.narration} onChange={e => updateScene(i, { narration: e.target.value })}
                placeholder={t('story.narration')} className={input} />
              <textarea rows={2} value={s.visualPrompt} onChange={e => updateScene(i, { visualPrompt: e.target.value })}
                placeholder={t('story.visualPrompt')} className={`${input} text-xs text-gray-600`} />
            </div>
          ))}
          {scenes.length < 12 && (
            <button type="button" onClick={() => setScenes(prev => [...prev, { narration: '', visualPrompt: '' }])}
              className="text-xs text-indigo-600 flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> {t('story.addScene')}
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select value={voiceId} onChange={e => setVoiceId(e.target.value)} className="h-8 px-2 rounded-lg border bg-white">
              {VOICES.map(v => <option key={v.id} value={v.id}>{v.name} — {t(`u10.voice.${v.descKey}`)}</option>)}
            </select>
            <select value={template} onChange={e => setTemplate(e.target.value as typeof template)} className="h-8 px-2 rounded-lg border bg-white">
              {TEMPLATES.map(tp => <option key={tp} value={tp}>{t(`story.template.${tp}`)}</option>)}
            </select>
            <select value={aspect} onChange={e => setAspect(e.target.value as typeof aspect)} className="h-8 px-2 rounded-lg border bg-white">
              {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={bgm} onChange={e => setBgm(e.target.checked)} /> {t('story.bgm')}
            </label>
            <button type="button" onClick={startRender}
              disabled={busy !== null || !scenes.some(s => s.narration.trim() && s.visualPrompt.trim())}
              className="h-8 px-3 rounded-lg bg-indigo-600 text-white flex items-center gap-1 disabled:opacity-50">
              {busy === 'render' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clapperboard className="h-3.5 w-3.5" />}
              {t('story.render')}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">{t('story.costHint')}</p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {jobs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">{t('story.recent')}</p>
          {jobs.map(j => (
            <div key={j.id} className="rounded-xl border bg-white p-3 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{j.title || t('story.untitled')} · {t('story.sceneTotal', { n: j.scenes?.length ?? 0 })}</span>
                <span className={j.status === 'done' ? 'text-green-600' : j.status === 'failed' ? 'text-red-600' : 'text-indigo-600'}>
                  {(j.status === 'queued' || j.status === 'rendering') && <Loader2 className="inline h-3 w-3 animate-spin mr-1" />}
                  {t(`story.status.${j.status}`)}
                </span>
              </div>
              {j.status === 'failed' && j.error && <p className="text-red-500 break-all">{j.error}</p>}
              {j.status === 'done' && j.output_url && (
                <>
                  <video src={j.output_url} controls className="w-full max-h-96 rounded-lg bg-black" />
                  <a href={j.output_url} download className="inline-flex items-center gap-1 text-indigo-600">
                    <Download className="h-3.5 w-3.5" /> {t('story.download')}
                  </a>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
