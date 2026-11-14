// AI 回覆裡的「[圖片] 網址」在 LINE 等平台送出時會被換成真的圖片（見 cs-webhook 的 extractImageUrls），
// 收件匣顯示時用同一規則拆出來直接顯示圖片，不要只秀網址文字。
const IMAGE_URL_RE = /(?:\[圖片\]\s*)?(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp))/gi

export function splitBubbleImages(text: string): { text: string; images: string[] } {
  if (!text) return { text: '', images: [] }
  const images: string[] = []
  const rest = text
    .replace(IMAGE_URL_RE, (_m, url: string) => { images.push(url); return '' })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text: rest, images }
}
