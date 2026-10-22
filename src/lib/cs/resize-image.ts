// 收件匣訊息時間：今天只顯示時:分，其他日期加上月/日（台灣時間）
export function formatBubbleTime(ts: string, locale: string): string {
  try {
    const d = new Date(ts)
    const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
    const sameDay = day(d) === day(new Date())
    return d.toLocaleString(locale, {
      timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false,
      ...(sameDay ? {} : { month: '2-digit', day: '2-digit' }),
    })
  } catch { return '' }
}

// 收件匣真人傳圖：送出前在瀏覽器縮圖並轉 JPEG（LINE 預覽圖上限 1MB，原圖常常 3–8MB）
export async function resizeImageForSend(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.fillStyle = '#fff'  // 透明 PNG 轉 JPEG 時底色用白色
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality))
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 上傳到收件匣圖片空間，回傳路徑（之後交給 /api/marketing/cs-send 的 imagePath）
export async function uploadInboxImage(file: File, to: string): Promise<string> {
  const blob = await resizeImageForSend(file)
  const fd = new FormData()
  fd.append('file', blob, 'image.jpg')
  fd.append('to', to)
  const res = await fetch('/api/marketing/cs-upload', { method: 'POST', body: fd })
  const d = await res.json().catch(() => ({}))
  if (!res.ok || !d.path) throw new Error(d.error ?? '圖片上傳失敗')
  return d.path as string
}
