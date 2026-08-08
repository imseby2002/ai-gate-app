import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

// ── URL 類型判斷 ──────────────────────────────────────────────────────────────

export type SourceType = 'youtube' | 'tiktok' | 'instagram' | 'blog'

export function detectSourceType(url: string): SourceType {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('instagram.com')) return 'instagram'
  return 'blog'
}

// ── YouTube ───────────────────────────────────────────────────────────────────

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

async function fetchYouTubeDetails(videoId: string): Promise<{ title: string; description: string; channelTitle: string } | null> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return null
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`)
  if (!res.ok) return null
  const data = await res.json() as { items?: { snippet?: { title?: string; description?: string; channelTitle?: string } }[] }
  const item = data.items?.[0]?.snippet
  if (!item) return null
  return { title: item.title ?? '', description: item.description ?? '', channelTitle: item.channelTitle ?? '' }
}

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    const html = await pageRes.text()
    const match = html.match(/"captionTracks":(\[.*?\])/)
    if (!match) return ''

    type CaptionTrack = { vssId?: string; baseUrl?: string; languageCode?: string }
    const tracks = JSON.parse(match[1]) as CaptionTrack[]
    const track =
      tracks.find(t => t.languageCode?.startsWith('zh') || t.vssId?.includes('.zh')) ||
      tracks.find(t => t.languageCode?.startsWith('en') || t.vssId?.includes('.en')) ||
      tracks[0]

    if (!track?.baseUrl) return ''

    const transcriptRes = await fetch(`${track.baseUrl}&fmt=json3`)
    const transcriptData = await transcriptRes.json() as { events?: { segs?: { utf8: string }[] }[] }
    return (transcriptData.events ?? [])
      .filter(e => e.segs)
      .map(e => (e.segs ?? []).map(s => s.utf8).join(''))
      .join(' ')
      .replace(/\n/g, ' ')
      .trim()
  } catch {
    return ''
  }
}

async function fetchYouTubeContent(url: string): Promise<string> {
  const videoId = extractVideoId(url)
  if (!videoId) throw new Error('無效的 YouTube URL')
  const [details, transcript] = await Promise.all([fetchYouTubeDetails(videoId), fetchYouTubeTranscript(videoId)])
  const parts: string[] = []
  if (details) {
    parts.push(`# ${details.title}\n頻道：${details.channelTitle}`)
    if (details.description) parts.push(`說明欄：\n${details.description}`)
  }
  if (transcript) parts.push(`逐字稿：\n${transcript}`)
  return parts.join('\n\n')
}

// ── Tavily Extract（TikTok / Instagram / 一般網頁）────────────────────────────

async function fetchViaTavily(url: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return ''
  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, urls: [url] }),
    })
    if (!res.ok) return ''
    const data = await res.json() as { results?: { raw_content?: string }[]; failed_results?: unknown[] }
    return data.results?.[0]?.raw_content?.trim() ?? ''
  } catch {
    return ''
  }
}

// ── 純 HTML fetch（Blog 後備，沒有 Tavily key 或抓取失敗時）───────────────────

async function fetchWebContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      },
    })
    if (!res.ok) return ''
    const html = await res.text()
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60000)
  } catch {
    return ''
  }
}

// ── Claude 合成（取代 NotebookLM 步驟）────────────────────────────────────────

async function synthesizeKnowledge(raw: string, expertName: string): Promise<string> {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: `你是知識萃取專家，專門將創作者的內容整理成可供 AI 系統直接引用的結構化知識庫。
輸出格式為 Markdown，內容需具體可操作，避免空泛描述。請以繁體中文輸出。`,
    messages: [{
      role: 'user',
      content: `以下是創作者「${expertName}」的內容。請萃取並整理成以下格式：

## 核心方法論
（可操作的步驟與框架）

## 關鍵原則
（每個原則附實際例子）

## 獨特視角
（與一般觀點的差異、反直覺觀點）

## 常見錯誤（反例）
（指出他人常犯的錯誤）

## 核心觀點
（可直接引用的金句與具體案例）

---
原始內容：
${raw.slice(0, 80000)}`,
    }],
    maxOutputTokens: 4000,
  })
  return text
}

// ── 主 Pipeline ───────────────────────────────────────────────────────────────

/** 模式一：URL（YouTube / Blog，TikTok / Instagram 視 TAVILY_API_KEY 是否設定而定） */
export async function processExpertUrl(url: string, expertName: string): Promise<{ raw: string; structured: string }> {
  const sourceType = detectSourceType(url)
  let raw = ''

  if (sourceType === 'youtube') {
    raw = await fetchYouTubeContent(url)
  } else if (sourceType === 'tiktok' || sourceType === 'instagram') {
    raw = await fetchViaTavily(url)
    if (!raw) {
      throw new Error(
        `${sourceType === 'tiktok' ? 'TikTok' : 'Instagram Reels'} 影片無法自動取得字幕。` +
        '建議改用「搜尋」或「手動輸入」模式。'
      )
    }
  } else {
    raw = await fetchViaTavily(url)
    if (!raw) raw = await fetchWebContent(url)
  }

  if (!raw.trim()) throw new Error('無法取得內容，請確認 URL 是否正確或該頁面可公開存取')
  const structured = await synthesizeKnowledge(raw, expertName)
  return { raw, structured }
}

/** 模式二：搜尋（輸入創作者/主題名稱，Tavily 搜尋第三方分析後合成） */
export async function processExpertSearch(expertName: string, query: string): Promise<{ raw: string; structured: string }> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) throw new Error('搜尋功能未設定（缺少 TAVILY_API_KEY），請改用 URL 或手動輸入模式')

  const searchQuery = query.trim() || `${expertName} 方法論 技巧 分析`

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: searchQuery,
      search_depth: 'advanced',
      max_results: 8,
      include_answer: true,
      include_raw_content: false,
    }),
  })
  if (!res.ok) throw new Error('搜尋失敗，請稍後再試')

  const data = await res.json() as {
    answer?: string
    results?: { title: string; url: string; content: string }[]
  }

  if (!data.results?.length) throw new Error(`找不到「${expertName}」的相關分析，請嘗試手動輸入`)

  const parts: string[] = []
  if (data.answer) parts.push(`【摘要】${data.answer}`)
  for (const r of data.results) {
    parts.push(`【${r.title}】\n${r.content}\n來源：${r.url}`)
  }
  const raw = parts.join('\n\n---\n\n')

  const structured = await synthesizeKnowledge(raw, expertName)
  return { raw, structured }
}

/** 模式三：手動輸入（用戶自己整理的筆記 / 逐字稿） */
export async function processExpertManual(content: string, expertName: string): Promise<{ raw: string; structured: string }> {
  if (!content.trim()) throw new Error('請輸入內容')
  const structured = await synthesizeKnowledge(content.trim(), expertName)
  return { raw: content.trim(), structured }
}
