// 抓取網址並萃取純文字（給自製專家知識來源用）。
// 與 geo/audit 的 stripHtml 同套作法：移除 script/style/標籤，壓縮空白。
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function fetchUrlText(url: string, maxChars = 50000): Promise<string> {
  const full = url.startsWith('http') ? url : `https://${url}`
  const res = await fetch(full, {
    headers: { 'User-Agent': 'Mozilla/5.0 (AI-GATE expert ingest)' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`無法抓取頁面（HTTP ${res.status}）`)
  const html = await res.text()
  return stripHtml(html).slice(0, maxChars)
}
