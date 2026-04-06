'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import type { AIModel } from '@/types/database'

const PROVIDER_LABELS: Record<string, string> = {
  deepseek: 'DeepSeek', google: 'Google', anthropic: 'Anthropic',
  perplexity: 'Perplexity', fal: 'FAL AI', kling: 'Kling', veo: 'VEO',
}

const MODALITY_LABELS: Record<string, string> = {
  text: '文字', multimodal: '多模態', image: '圖片', video: '影片',
}

export function ModelConfigTable({ models }: { models: AIModel[] }) {
  const router = useRouter()
  const [updating, setUpdating] = useState<string | null>(null)

  const toggleEnabled = async (model: AIModel) => {
    setUpdating(model.id)
    await fetch('/api/admin/models', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId: model.id, is_enabled: !model.is_enabled }),
    })
    setUpdating(null)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-500">模型</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">提供商</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">類型</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">輸入費率 /1K</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">輸出費率 /1K</th>
              <th className="text-center px-5 py-3 font-medium text-gray-500">狀態</th>
            </tr>
          </thead>
          <tbody>
            {models.map(model => (
              <tr key={model.id} className={`border-b last:border-0 hover:bg-gray-50 ${!model.is_enabled ? 'opacity-50' : ''}`}>
                <td className="px-5 py-3">
                  <div className="font-medium">{model.display_name}</div>
                  <div className="text-xs text-gray-400">{model.id}</div>
                </td>
                <td className="px-5 py-3 text-gray-600">{PROVIDER_LABELS[model.provider] ?? model.provider}</td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {MODALITY_LABELS[model.modality] ?? model.modality}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-mono text-xs">
                  {model.input_cost_per_1k > 0 ? `$${model.input_cost_per_1k}` : '—'}
                </td>
                <td className="px-5 py-3 text-right font-mono text-xs">
                  {model.output_cost_per_1k > 0 ? `$${model.output_cost_per_1k}` : '—'}
                </td>
                <td className="px-5 py-3 text-center">
                  <button
                    onClick={() => toggleEnabled(model)}
                    disabled={updating === model.id}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${model.is_enabled ? 'bg-green-500' : 'bg-gray-200'}`}
                  >
                    {updating === model.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mx-auto text-white" />
                    ) : (
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${model.is_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
