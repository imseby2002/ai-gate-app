'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, CheckCircle2, Loader2, Trash2, ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'

// ─── Platform definitions ─────────────────────────────────────────────────────

interface FieldDef {
  key: string
  label: string
  placeholder: string
  secret?: boolean
  hint?: string   // Settings.social.hints 的 key
}

interface PlatformDef {
  id: string
  name: string
  category: 'image' | 'video'
  color: string
  docUrl: string
  fields: FieldDef[]
}

const PLATFORMS: PlatformDef[] = [
  // ── Image / Text ──────────────────────────────────────────────────────────
  {
    id: 'Facebook', name: 'Facebook', category: 'image',
    color: '#1877F2', docUrl: 'https://developers.facebook.com/docs/pages-api',
    fields: [
      { key: 'page_access_token', label: 'Page Access Token', placeholder: 'EAABsbCS...', secret: true,
        hint: 'fbToken' },
      { key: 'page_id', label: 'Page ID', placeholder: '123456789012345',
        hint: 'fbPageId' },
    ],
  },
  {
    id: 'Instagram', name: 'Instagram', category: 'image',
    color: '#E1306C', docUrl: 'https://developers.facebook.com/docs/instagram-api',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'EAABsbCS...', secret: true,
        hint: 'igToken' },
      { key: 'ig_user_id', label: 'Instagram Business Account ID', placeholder: '17841400000000000',
        hint: 'igUserId' },
    ],
  },
  {
    id: 'Threads', name: 'Threads', category: 'image',
    color: '#000000', docUrl: 'https://developers.facebook.com/docs/threads',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'THRAASx...', secret: true,
        hint: 'threadsToken' },
      { key: 'threads_user_id', label: 'Threads User ID', placeholder: '17841400000000000',
        hint: 'threadsUserId' },
    ],
  },
  {
    id: 'LinkedIn', name: 'LinkedIn', category: 'image',
    color: '#0A66C2', docUrl: 'https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'AQVx...', secret: true,
        hint: 'liToken' },
      { key: 'author_urn', label: 'Author URN', placeholder: 'urn:li:person:xxxxxxxx / urn:li:organization:xxxxxxxx',
        hint: 'liUrn' },
    ],
  },
  {
    id: 'Twitter/X', name: 'Twitter / X', category: 'image',
    color: '#000000', docUrl: 'https://developer.twitter.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxxxxxxxxxx', secret: true,
        hint: 'xKey' },
      { key: 'api_secret', label: 'API Key Secret', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
      { key: 'access_token', label: 'Access Token', placeholder: '00000000-xxxxxxx', secret: true },
      { key: 'access_token_secret', label: 'Access Token Secret', placeholder: 'xxxxxxxxxxxxx', secret: true },
    ],
  },
  {
    id: 'LINE VOOM', name: 'LINE VOOM', category: 'image',
    color: '#06C755', docUrl: 'https://developers.line.biz/en/docs/messaging-api/',
    fields: [
      { key: 'channel_access_token', label: 'Channel Access Token', placeholder: 'xxxxx...', secret: true,
        hint: 'lineToken' },
    ],
  },
  {
    id: 'Zalo', name: 'Zalo Timeline', category: 'image',
    color: '#0068FF', docUrl: 'https://developers.zalo.me/docs/api/social-api',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'xxxxxxxx', secret: true,
        hint: 'zaloToken' },
      { key: 'oa_id', label: 'OA ID', placeholder: '0000000000000000000',
        hint: 'zaloOaId' },
    ],
  },
  // ── Video ─────────────────────────────────────────────────────────────────
  {
    id: 'FB Reels', name: 'FB Reels', category: 'video',
    color: '#1877F2', docUrl: 'https://developers.facebook.com/docs/video-api/reels-api',
    fields: [
      { key: 'note', label: 'Note', placeholder: '',
        hint: 'fbReels' },
    ],
  },
  {
    id: 'IG Reels', name: 'IG Reels', category: 'video',
    color: '#E1306C', docUrl: 'https://developers.facebook.com/docs/instagram-api/reference/ig-user/media',
    fields: [
      { key: 'note', label: 'Note', placeholder: '',
        hint: 'igReels' },
    ],
  },
  {
    id: 'YouTube Shorts', name: 'YouTube Shorts', category: 'video',
    color: '#FF0000', docUrl: 'https://developers.google.com/youtube/v3/guides/uploading_a_video',
    fields: [
      { key: 'client_id', label: 'OAuth Client ID', placeholder: 'xxxxxx.apps.googleusercontent.com', secret: false,
        hint: 'ytClientId' },
      { key: 'client_secret', label: 'OAuth Client Secret', placeholder: 'GOCSPX-xxxxx', secret: true },
      { key: 'refresh_token', label: 'Refresh Token', placeholder: '1//xxxxxxxx', secret: true,
        hint: 'ytRefresh' },
    ],
  },
  {
    id: 'TikTok', name: 'TikTok', category: 'video',
    color: '#000000', docUrl: 'https://developers.tiktok.com/doc/content-posting-api-get-started',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'act.xxxxxxxxx', secret: true,
        hint: 'tiktokToken' },
    ],
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface PlatformStatus {
  is_connected: boolean
  preview: Record<string, string>
}

export function SocialPlatformSettings() {
  const t = useTranslations('Settings.social')
  const [statuses, setStatuses] = useState<Record<string, PlatformStatus>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/social/credentials')
      .then(r => r.json())
      .then(d => setStatuses(d.platforms ?? {}))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id)

  const setValue = (platformId: string, key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [platformId]: { ...(prev[platformId] ?? {}), [key]: value },
    }))
  }

  const handleSave = async (platform: PlatformDef) => {
    const creds = formData[platform.id] ?? {}
    setSaving(platform.id)
    try {
      await fetch('/api/social/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: platform.id, credentials: creds }),
      })
      // Refresh status
      const res = await fetch('/api/social/credentials')
      const d = await res.json()
      setStatuses(d.platforms ?? {})
      setSavedMsg(platform.id)
      setTimeout(() => setSavedMsg(null), 3000)
    } finally {
      setSaving(null)
    }
  }

  const handleDisconnect = async (platformId: string) => {
    await fetch(`/api/social/credentials?platform=${encodeURIComponent(platformId)}`, { method: 'DELETE' })
    setStatuses(prev => ({ ...prev, [platformId]: { is_connected: false, preview: {} } }))
  }

  const imageGroup = PLATFORMS.filter(p => p.category === 'image')
  const videoGroup = PLATFORMS.filter(p => p.category === 'video')

  const renderPlatform = (platform: PlatformDef) => {
    const status = statuses[platform.id]
    const isOpen = expanded === platform.id
    const isSaving = saving === platform.id
    const saved = savedMsg === platform.id
    const isNoteOnly = platform.fields.length === 1 && platform.fields[0].key === 'note'

    return (
      <div key={platform.id} className="border rounded-xl overflow-hidden">
        {/* Header */}
        <button
          type="button"
          onClick={() => toggle(platform.id)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: platform.color }} />
            <span className="text-sm font-medium">{platform.name}</span>
            {status?.is_connected && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="h-3 w-3" /> {t('connected')}
              </span>
            )}
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>

        {/* Body */}
        {isOpen && (
          <div className="px-4 pb-4 pt-1 border-t bg-gray-50 space-y-3">
            {isNoteOnly ? (
              <p className="text-xs text-gray-500 pt-2">{platform.fields[0].hint && t(`hints.${platform.fields[0].hint}`)}</p>
            ) : (
              <>
                {platform.fields.map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium mb-1">
                      {field.label}
                      <a href={platform.docUrl} target="_blank" rel="noopener noreferrer"
                        className="ml-2 text-blue-400 hover:underline font-normal inline-flex items-center gap-0.5">
                        {t('docs')} <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </label>
                    <input
                      type={field.secret ? 'password' : 'text'}
                      defaultValue={formData[platform.id]?.[field.key] ?? ''}
                      onChange={e => setValue(platform.id, field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full h-9 px-3 rounded-lg border text-xs outline-none focus:ring-2 bg-white font-mono"
                    />
                    {field.hint && (
                      <p className="text-xs text-gray-400 mt-1">{t(`hints.${field.hint}`)}</p>
                    )}
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSave(platform)}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                    style={{ background: 'var(--primary)' }}
                  >
                    {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                    {isSaving ? t('saving') : t('save')}
                  </button>
                  {status?.is_connected && (
                    <button
                      type="button"
                      onClick={() => handleDisconnect(platform.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> {t('clear')}
                    </button>
                  )}
                  {saved && <span className="text-xs text-green-600">✓ {t('saved')}</span>}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
        </div>
      ) : (
        <>
          {/* Image / Text platforms */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {t('imageGroup')}
            </div>
            <div className="space-y-2">
              {imageGroup.map(renderPlatform)}
            </div>
          </div>

          {/* Video platforms */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {t('videoGroup')}
            </div>
            <div className="space-y-2">
              {videoGroup.map(renderPlatform)}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
