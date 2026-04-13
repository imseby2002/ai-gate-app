'use client'

import { useState, useRef } from 'react'
import { Loader2, Sparkles, FileText, Upload, X, ClipboardCopy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]

const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.pdf,.doc,.docx'

function FileTag({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs bg-gray-50 text-gray-700 max-w-[220px]">
      <FileText className="h-3 w-3 shrink-0 text-gray-400" />
      <span className="truncate">{name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="移除檔案"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

export default function ResumePage() {
  const [jd, setJd] = useState('')
  const [experience, setExperience] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    setFileError('')
    if (!selected) return
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setFileError('僅支援 JPG、PDF、Word 檔案格式')
      e.target.value = ''
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      setFileError('檔案大小不可超過 10 MB')
      e.target.value = ''
      return
    }
    setFile(selected)
  }

  const removeFile = () => {
    setFile(null)
    setFileError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!jd.trim() && !experience.trim()) return
    setLoading(true)
    setError('')
    setResult('')

    try {
      // Placeholder: replace with actual API call when backend is ready
      // const formData = new FormData()
      // formData.append('jd', jd)
      // formData.append('experience', experience)
      // if (file) formData.append('resume', file)
      // const res = await fetch('/api/resume/optimize', { method: 'POST', body: formData })
      // const data = await res.json()
      // if (!res.ok) throw new Error(data.error)
      // setResult(data.result)

      // Demo: simulate streaming result
      await new Promise(r => setTimeout(r, 1200))
      setResult(
        '## 精準優化後的履歷摘要\n\n' +
        '**職缺關鍵詞已整合**\n' +
        '根據您提供的目標職缺，以下是針對性優化建議：\n\n' +
        '**工作經歷（優化版）**\n' +
        '- 主導跨部門專案，提升流程效率 35%，與目標職位「專案管理」要求高度吻合\n' +
        '- 運用數據分析工具（Python / SQL）完成每月業績報告，直接對應 JD 中「數據驅動決策」需求\n' +
        '- 帶領 5 人團隊達成季度 KPI，展現 JD 所需領導力\n\n' +
        '**技能關鍵字（ATS 友善）**\n' +
        'Project Management · Data Analysis · Python · SQL · Cross-functional Collaboration · KPI Management\n\n' +
        '**自我介紹（優化版）**\n' +
        '具備 3 年以上產品與數據分析經驗，擅長將複雜數據轉化為可執行策略。\n' +
        '積極主動、溝通能力強，期待加入貴團隊持續成長。\n\n' +
        '---\n_此結果由 AI 生成，請依實際情況調整後使用。_'
      )
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canSubmit = (jd.trim().length > 0 || experience.trim().length > 0) && !loading

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6" style={{ color: 'var(--primary)' }} />
          精準履歷優化器
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          輸入目標職缺與過往經歷，AI 將為您生成高度匹配的優化履歷
        </p>
      </div>

      {/* Split-screen layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* ── Left: Input Form ── */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">輸入資料</CardTitle>
            <CardDescription>填寫越詳細，優化結果越精準</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* JD */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                目標職缺 JD
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <Textarea
                value={jd}
                onChange={e => setJd(e.target.value)}
                rows={6}
                placeholder={'貼上職缺描述（Job Description）…\n\n例如：\n- 負責產品數據分析與報表\n- 需具備 SQL、Python 技能\n- 3 年以上相關工作經驗'}
                className="resize-none text-sm leading-relaxed"
              />
            </div>

            {/* Experience */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                過往經歷
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <Textarea
                value={experience}
                onChange={e => setExperience(e.target.value)}
                rows={6}
                placeholder={'描述您的工作經歷、技能與成就…\n\n例如：\n- 2021–2024 ABC 公司，數據分析師\n- 使用 Python 建立自動化報表系統\n- 帶領 3 人小組完成季度專案'}
                className="resize-none text-sm leading-relaxed"
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                上傳現有履歷
                <span className="text-xs text-gray-400 font-normal ml-1.5">（選填）</span>
              </label>
              <div
                className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition-colors hover:bg-gray-50"
                onClick={() => fileInputRef.current?.click()}
                style={file ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 4%, transparent)' } : {}}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  className="sr-only"
                  onChange={handleFileChange}
                />
                {file ? (
                  <FileTag name={file.name} onRemove={e => { e.stopPropagation(); removeFile() }} />
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-gray-400" />
                    <p className="text-xs text-gray-500 text-center">
                      點擊上傳或拖曳檔案至此<br />
                      <span className="text-gray-400">支援 JPG · PDF · Word（最大 10 MB）</span>
                    </p>
                  </>
                )}
              </div>
              {fileError && (
                <p className="text-xs text-red-600">{fileError}</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-5 text-sm font-semibold rounded-xl"
              size="lg"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" />優化中，請稍候…</>
                : <><Sparkles className="h-4 w-4" />開始優化</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* ── Right: Result Display ── */}
        <Card className="rounded-2xl shadow-sm lg:sticky lg:top-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">AI 優化結果</CardTitle>
                <CardDescription className="mt-1">優化後的履歷內容將顯示於此</CardDescription>
              </div>
              {result && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0 gap-1.5 text-xs"
                >
                  {copied
                    ? <><Check className="h-3.5 w-3.5 text-green-600" />已複製</>
                    : <><ClipboardCopy className="h-3.5 w-3.5" />複製</>
                  }
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-3 animate-pulse">
                {[100, 80, 90, 60, 75, 85, 55].map((w, i) => (
                  <div
                    key={i}
                    className="h-3 rounded-full bg-gray-200"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
            )}

            {/* Result content */}
            {!loading && result && (
              <div className="min-h-[300px]">
                <Textarea
                  readOnly
                  value={result}
                  rows={20}
                  className="resize-none text-sm leading-relaxed bg-gray-50 cursor-default focus-visible:ring-0 border-gray-200"
                />
              </div>
            )}

            {/* Empty state */}
            {!loading && !result && (
              <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 text-center rounded-xl border-2 border-dashed border-gray-200 p-8">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'color-mix(in oklch, var(--primary) 10%, transparent)' }}
                >
                  <FileText className="h-6 w-6" style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">尚無優化結果</p>
                  <p className="text-xs text-gray-400 mt-1">
                    填寫左側表單並點擊「開始優化」<br />AI 生成的履歷將顯示在這裡
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
