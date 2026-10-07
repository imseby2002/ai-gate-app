// 以 templates 字典翻譯範本顯示文字（id、prompt、gradient 等不變）
import type { VisualTemplate } from '@/lib/marketing/visual-templates'
import type { VideoTemplate } from '@/lib/marketing/video-templates'

type Tr = (s: string | undefined) => string

export function localizeVisual(x: VisualTemplate, tr: Tr): VisualTemplate {
  return {
    ...x,
    title: tr(x.title),
    feeling: tr(x.feeling),
    applicability: tr(x.applicability),
    paramAdvice: tr(x.paramAdvice),
    badge: x.badge ? tr(x.badge) : x.badge,
    tags: x.tags.map(tr),
  }
}

// rawScript 由分鏡組成（time：content，time 為「階段」時只有 content），翻譯後重組
export function localizeVideo(x: VideoTemplate, tr: Tr): VideoTemplate {
  const timeline = x.scriptTimeline.map(i => ({ time: tr(i.time), content: tr(i.content) }))
  const rebuilt = x.scriptTimeline.map(i => (i.time === '階段' ? i.content : `${i.time}：${i.content}`)).join('\n\n')
  const sep = tr(x.title) !== x.title ? ': ' : '：'
  return {
    ...x,
    title: tr(x.title),
    applicability: tr(x.applicability),
    params: tr(x.params),
    badge: x.badge ? tr(x.badge) : x.badge,
    tags: x.tags.map(tr),
    scriptTimeline: timeline,
    rawScript: rebuilt === x.rawScript
      ? x.scriptTimeline.map((i, k) => (i.time === '階段' ? timeline[k].content : `${timeline[k].time}${sep}${timeline[k].content}`)).join('\n\n')
      : tr(x.rawScript),
  }
}
