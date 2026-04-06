'use client'

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AIModel } from '@/types/database'

interface ModelSelectorProps {
  models: AIModel[]
  value: string | null
  onChange: (value: string | null) => void
}

const MODALITY_LABELS: Record<string, string> = {
  text: '文字模型',
  multimodal: '多模態',
  image: '圖片生成',
  video: '影片生成',
}

const ROUTING_HINT: Record<string, string> = {
  'deepseek-chat': '日常對話',
  'deepseek-reasoner': '財務/推理',
  'gemini-2.0-flash': '創意/行銷',
  'claude-opus-4-5': '深度分析',
  'perplexity-sonar-pro': '法條查證',
  'gemini-2.0-flash-vision': '圖片/OCR',
}

export function ModelSelector({ models, value, onChange }: ModelSelectorProps) {
  const textModels = models.filter(m => m.modality === 'text' || m.modality === 'multimodal')

  return (
    <Select value={value ?? 'auto'} onValueChange={(v: string) => onChange(v === 'auto' ? null : v)}>
      <SelectTrigger className="w-52 h-8 text-xs">
        <SelectValue placeholder="自動選擇模型" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>智能路由</SelectLabel>
          <SelectItem value="auto">🤖 自動選擇（推薦）</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>文字/多模態模型</SelectLabel>
          {textModels.map(model => (
            <SelectItem key={model.id} value={model.id}>
              <span className="font-medium">{model.display_name}</span>
              {ROUTING_HINT[model.id] && (
                <span className="ml-2 text-xs text-muted-foreground">（{ROUTING_HINT[model.id]}）</span>
              )}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
