/**
 * GEO Writer — 發佈到第三方平台（Facebook 粉專、Blogger、Medium、Ghost、Notion、Dev.to）。
 * 每個 publisher 成功回傳文章網址，失敗丟出含平台名稱的錯誤訊息。
 */
import { createHmac } from 'crypto'
import { safeFetch } from '@/lib/ssrf'

export type GeoPlatform = 'facebook' | 'blogger' | 'medium' | 'ghost' | 'notion' | 'devto'
export const GEO_PLATFORMS: GeoPlatform[] = ['facebook', 'blogger', 'medium', 'ghost', 'notion', 'devto']

export interface GeoPlatformSettings {
  medium?: { token?: string }
  ghost?: { url?: string; adminKey?: string }
  notion?: { token?: string; parentPageId?: string }
  devto?: { apiKey?: string }
  blogger?: { blogUrl?: string }
}

export interface GeoArticleForPublish {
  title: string
  bodyMd: string
  bodyHtml: string
  /** 本站落地頁網址，給只能放摘要的平台（Facebook）導流用 */
  landingUrl: string
}

const TIMEOUT = 20000

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  return `${res.status} ${text.slice(0, 300)}`
}

/** Markdown → 純文字（給 Facebook 貼文用） */
export function mdToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1（$2）')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/^\|.*\|$/gm, l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()).join('｜'))
    .replace(/^[|:\-\s｜]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── Medium ────────────────────────────────────────────────────────────────
export async function publishMedium(cfg: GeoPlatformSettings['medium'], a: GeoArticleForPublish): Promise<string> {
  const token = cfg?.token?.trim()
  if (!token) throw new Error('尚未設定 Medium Integration Token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }
  const me = await fetch('https://api.medium.com/v1/me', { headers, signal: AbortSignal.timeout(TIMEOUT) })
  if (!me.ok) throw new Error(`Medium 驗證失敗 ${await readError(me)}`)
  const userId = (await me.json())?.data?.id
  if (!userId) throw new Error('Medium 取不到使用者 ID')
  const res = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
    method: 'POST', headers, signal: AbortSignal.timeout(TIMEOUT),
    body: JSON.stringify({ title: a.title, contentFormat: 'markdown', content: `# ${a.title}\n\n${a.bodyMd}`, publishStatus: 'public' }),
  })
  if (!res.ok) throw new Error(`Medium 發佈失敗 ${await readError(res)}`)
  return (await res.json())?.data?.url ?? ''
}

// ── Ghost（Admin API Key：id:secret，產生 5 分鐘 JWT）────────────────────
function ghostToken(adminKey: string): string {
  const [id, secret] = adminKey.split(':')
  if (!id || !secret) throw new Error('Ghost Admin API Key 格式應為「id:secret」')
  const b64 = (o: object | Buffer) => Buffer.from(o instanceof Buffer ? o : JSON.stringify(o)).toString('base64url')
  const iat = Math.floor(Date.now() / 1000)
  const unsigned = `${b64({ alg: 'HS256', typ: 'JWT', kid: id })}.${b64({ iat, exp: iat + 300, aud: '/admin/' })}`
  const sig = createHmac('sha256', Buffer.from(secret, 'hex')).update(unsigned).digest('base64url')
  return `${unsigned}.${sig}`
}

export async function publishGhost(cfg: GeoPlatformSettings['ghost'], a: GeoArticleForPublish): Promise<string> {
  const base = cfg?.url?.trim().replace(/\/$/, '')
  const key = cfg?.adminKey?.trim()
  if (!base || !key) throw new Error('尚未設定 Ghost 網址與 Admin API Key')
  const res = await safeFetch(`${base}/ghost/api/admin/posts/?source=html`, {
    method: 'POST',
    headers: { Authorization: `Ghost ${ghostToken(key)}`, 'Content-Type': 'application/json', 'Accept-Version': 'v5.0' },
    body: JSON.stringify({ posts: [{ title: a.title, html: a.bodyHtml, status: 'published' }] }),
    signal: AbortSignal.timeout(TIMEOUT),
  })
  if (!res.ok) throw new Error(`Ghost 發佈失敗 ${await readError(res)}`)
  return (await res.json())?.posts?.[0]?.url ?? ''
}

// ── Dev.to ────────────────────────────────────────────────────────────────
export async function publishDevto(cfg: GeoPlatformSettings['devto'], a: GeoArticleForPublish): Promise<string> {
  const key = cfg?.apiKey?.trim()
  if (!key) throw new Error('尚未設定 Dev.to API Key')
  const res = await fetch('https://dev.to/api/articles', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/vnd.forem.api-v1+json' },
    body: JSON.stringify({ article: { title: a.title, body_markdown: a.bodyMd, published: true } }),
    signal: AbortSignal.timeout(TIMEOUT),
  })
  if (!res.ok) throw new Error(`Dev.to 發佈失敗 ${await readError(res)}`)
  return (await res.json())?.url ?? ''
}

// ── Notion（在指定頁面底下建立子頁面）─────────────────────────────────────
type NotionBlock = Record<string, unknown>
function richText(text: string) {
  const out: Array<Record<string, unknown>> = []
  // 連結 [t](url) 轉成 Notion 連結，其餘為純文字；每段上限 2000 字
  const re = /\[([^\]]+)\]\((https?:[^)]+)\)/g
  let last = 0
  const push = (content: string, url?: string) => {
    const clean = content.replace(/\*\*([^*]+)\*\*/g, '$1')
    for (let i = 0; i < clean.length; i += 2000) {
      out.push({ type: 'text', text: { content: clean.slice(i, i + 2000), ...(url ? { link: { url } } : {}) } })
    }
  }
  for (let m; (m = re.exec(text));) {
    if (m.index > last) push(text.slice(last, m.index))
    push(m[1], m[2])
    last = m.index + m[0].length
  }
  if (last < text.length) push(text.slice(last))
  return out.length ? out : [{ type: 'text', text: { content: '' } }]
}
export function mdToNotionBlocks(md: string): NotionBlock[] {
  const blocks: NotionBlock[] = []
  const add = (type: string, text: string) => blocks.push({ object: 'block', type, [type]: { rich_text: richText(text) } })
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim() || /^[|:\-\s]+$/.test(line)) continue
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) { add(`heading_${h[1].length}`, h[2]); continue }
    const ul = line.match(/^\s*[-*]\s+(.*)$/)
    if (ul) { add('bulleted_list_item', ul[1]); continue }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (ol) { add('numbered_list_item', ol[1]); continue }
    if (/^\|.*\|$/.test(line)) { add('paragraph', line.replace(/^\||\|$/g, '').split('|').map(c => c.trim()).join('｜')); continue }
    add('paragraph', line)
  }
  return blocks
}

export async function publishNotion(cfg: GeoPlatformSettings['notion'], a: GeoArticleForPublish): Promise<string> {
  const token = cfg?.token?.trim()
  const parent = (cfg?.parentPageId ?? '').trim().match(/[0-9a-f]{32}|[0-9a-f-]{36}/i)?.[0]
  if (!token || !parent) throw new Error('尚未設定 Notion Integration Token 與上層頁面網址／ID')
  const headers = { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }
  const blocks = mdToNotionBlocks(a.bodyMd)
  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST', headers, signal: AbortSignal.timeout(TIMEOUT),
    body: JSON.stringify({
      parent: { page_id: parent },
      properties: { title: { title: [{ type: 'text', text: { content: a.title.slice(0, 2000) } }] } },
      children: blocks.slice(0, 100),
    }),
  })
  if (!res.ok) throw new Error(`Notion 發佈失敗 ${await readError(res)}`)
  const page = await res.json()
  // Notion 一次最多 100 個區塊，其餘分批附加
  for (let i = 100; i < blocks.length; i += 100) {
    const more = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children`, {
      method: 'PATCH', headers, signal: AbortSignal.timeout(TIMEOUT),
      body: JSON.stringify({ children: blocks.slice(i, i + 100) }),
    })
    if (!more.ok) throw new Error(`Notion 附加內容失敗 ${await readError(more)}`)
  }
  return page.url ?? ''
}

// ── Facebook 粉專（沿用社群平台已綁定的粉專憑證；貼摘要＋落地頁連結）──────
export async function publishFacebook(cred: { page_id?: string; page_access_token?: string } | null, a: GeoArticleForPublish): Promise<string> {
  if (!cred?.page_id || !cred.page_access_token) throw new Error('尚未綁定 Facebook 粉專（請先到社群平台設定綁定粉專）')
  const plain = mdToPlainText(a.bodyMd)
  const excerpt = plain.length > 1500 ? `${plain.slice(0, 1500)}…` : plain
  const message = `${a.title}\n\n${excerpt}\n\n👉 ${a.landingUrl}`
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(cred.page_id)}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message, link: a.landingUrl, access_token: cred.page_access_token }),
    signal: AbortSignal.timeout(TIMEOUT),
  })
  if (!res.ok) throw new Error(`Facebook 發佈失敗 ${await readError(res)}`)
  const id = (await res.json())?.id as string | undefined
  return id ? `https://www.facebook.com/${id}` : ''
}

// ── Blogger（Google OAuth，scope=blogger）──────────────────────────────────
export async function publishBlogger(accessToken: string | null, cfg: GeoPlatformSettings['blogger'], a: GeoArticleForPublish): Promise<string> {
  if (!accessToken) throw new Error('尚未連結 Blogger（請在發佈設定按「連結 Blogger」）')
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
  let blogId: string | undefined
  const blogUrl = cfg?.blogUrl?.trim()
  if (blogUrl) {
    const r = await fetch(`https://www.googleapis.com/blogger/v3/blogs/byurl?url=${encodeURIComponent(blogUrl)}`, { headers, signal: AbortSignal.timeout(TIMEOUT) })
    if (!r.ok) throw new Error(`Blogger 找不到部落格 ${await readError(r)}`)
    blogId = (await r.json())?.id
  } else {
    const r = await fetch('https://www.googleapis.com/blogger/v3/users/self/blogs', { headers, signal: AbortSignal.timeout(TIMEOUT) })
    if (!r.ok) throw new Error(`Blogger 讀取部落格清單失敗 ${await readError(r)}`)
    blogId = (await r.json())?.items?.[0]?.id
  }
  if (!blogId) throw new Error('Blogger 帳號下沒有部落格')
  const res = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/`, {
    method: 'POST', headers, signal: AbortSignal.timeout(TIMEOUT),
    body: JSON.stringify({ kind: 'blogger#post', title: a.title, content: a.bodyHtml }),
  })
  if (!res.ok) throw new Error(`Blogger 發佈失敗 ${await readError(res)}`)
  return (await res.json())?.url ?? ''
}
