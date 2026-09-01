'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Download,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  AlertCircle
} from 'lucide-react'
import {
  type ImportColumn,
  parseSpreadsheetFile,
  downloadExcelTemplate,
  downloadCsvTemplate,
} from '@/lib/excel/universal-import'

export interface BulkImportResult {
  inserted?: number
  updated?: number
  imported?: number
  skipped?: number
  errors?: { line: number; reason?: string; message?: string }[]
  error?: string
  ok?: boolean
}

export interface ExcelImportModalProps {
  title: string
  description?: string
  columns: ImportColumn[]
  templateFilename: string
  sheetName?: string
  onClose: () => void
  onSuccess?: () => void
  onSubmit: (rows: Record<string, unknown>[]) => Promise<BulkImportResult>
  extraHelp?: string[]
}

export function ExcelImportModal({
  title,
  description,
  columns,
  templateFilename,
  sheetName = '資料清單',
  onClose,
  onSuccess,
  onSubmit,
  extraHelp,
}: ExcelImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([])
  const [validationErrors, setValidationErrors] = useState<{ line: number; message: string }[]>([])
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const [serverError, setServerError] = useState('')
  const [activeTab, setActiveTab] = useState<'upload' | 'preview'>('upload')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleDownloadExcel = () => {
    downloadExcelTemplate(templateFilename, sheetName, columns)
  }

  const handleDownloadCsv = () => {
    downloadCsvTemplate(templateFilename, columns)
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (fileInputRef.current) fileInputRef.current.value = ''
    await processFile(selected)
  }

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile)
    setParsing(true)
    setServerError('')
    setResult(null)
    try {
      const res = await parseSpreadsheetFile(selectedFile, columns)
      setParsedRows(res.rows)
      setValidationErrors(res.errors)
      if (res.rows.length > 0) {
        setActiveTab('preview')
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : '檔案解析失敗，請確認檔案格式是否正確')
      setParsedRows([])
      setValidationErrors([])
    } finally {
      setParsing(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) {
      await processFile(dropped)
    }
  }

  const handleConfirmSubmit = async () => {
    if (parsedRows.length === 0) return
    setSubmitting(true)
    setServerError('')
    try {
      const res = await onSubmit(parsedRows)
      setResult(res)
      if (res.error) {
        setServerError(res.error)
      } else {
        const totalSuccessful = (res.inserted ?? 0) + (res.updated ?? 0) + (res.imported ?? 0)
        if (totalSuccessful > 0 || res.ok) {
          onSuccess?.()
        }
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : '匯入提交時發生錯誤')
    } finally {
      setSubmitting(false)
    }
  }

  const requiredCols = columns.filter(c => c.required)
  const previewColumns = columns.slice(0, 7) // display up to 7 columns in preview

  const totalSuccessCount = result
    ? (result.inserted ?? 0) + (result.updated ?? 0) + (result.imported ?? 0)
    : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col max-h-[90vh] w-full max-w-3xl rounded-xl border bg-white shadow-2xl dark:bg-gray-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {description || '支援 .xlsx, .xls 與 .csv 檔案，可自動批次建立或更新資料（Upsert）'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Instructions & Template Downloads */}
          <div className="rounded-xl border bg-slate-50/80 p-4 dark:bg-slate-900/40 dark:border-gray-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                1. 準備 Excel 試算表（或直接下載標準範本）
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
                  onClick={handleDownloadExcel}
                >
                  <Download className="h-3.5 w-3.5" />
                  下載 Excel 範本 (.xlsx)
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs text-gray-600 dark:text-gray-400"
                  onClick={handleDownloadCsv}
                >
                  <Download className="h-3.5 w-3.5" />
                  .csv 範本
                </Button>
              </div>
            </div>

            <ul className="list-disc pl-5 text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>
                <b>必填欄位：</b>
                {requiredCols.length > 0
                  ? requiredCols.map(c => c.label).join('、')
                  : '無特定必填（依各欄位自訂填寫）'}
              </li>
              <li>
                <b>更新機制：</b>若資料已存在（以關鍵編號/名稱對應），系統將自動為您更新內容；若不存在則自動新增。
              </li>
              {extraHelp?.map((help, idx) => (
                <li key={idx}>{help}</li>
              ))}
            </ul>
          </div>

          {/* Upload Area or Preview Toggle */}
          {!result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  2. 上傳填好的 Excel / CSV 檔案
                </span>
                {parsedRows.length > 0 && (
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg text-xs">
                    <button
                      onClick={() => setActiveTab('upload')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        activeTab === 'upload' ? 'bg-white shadow-xs text-primary dark:bg-gray-700' : 'text-gray-500'
                      }`}
                    >
                      重新選擇
                    </button>
                    <button
                      onClick={() => setActiveTab('preview')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        activeTab === 'preview' ? 'bg-white shadow-xs text-primary dark:bg-gray-700' : 'text-gray-500'
                      }`}
                    >
                      預覽資料 ({parsedRows.length} 筆)
                    </button>
                  </div>
                )}
              </div>

              {activeTab === 'upload' || parsedRows.length === 0 ? (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                    file
                      ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20'
                      : 'border-gray-200 hover:border-primary hover:bg-gray-50/60 dark:border-gray-800 dark:hover:bg-gray-900/60'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {parsing ? (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-sm font-medium text-gray-600">正在解析試算表檔案…</span>
                    </div>
                  ) : file ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <FileSpreadsheet className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        大小：{(file.size / 1024).toFixed(1)} KB・點此重新選擇或拖曳替換
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Upload className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          點擊此處選擇檔案，或直接將檔案拖曳至此
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          支援 Microsoft Excel (.xlsx, .xls) 及 CSV 格式
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Preview Table */
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5 text-primary" />
                      預覽前 {Math.min(parsedRows.length, 5)} 筆（共解析出 {parsedRows.length} 筆有效資料）
                    </span>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" /> 重新選檔
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-lg border max-h-56">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300 sticky top-0">
                        <tr className="border-b">
                          <th className="py-2 px-2.5 font-medium w-12 text-center">#</th>
                          {previewColumns.map(col => (
                            <th key={col.key} className="py-2 px-2.5 font-medium whitespace-nowrap">
                              {col.label}
                              {col.required && <span className="text-red-500 ml-0.5">*</span>}
                            </th>
                          ))}
                          {columns.length > previewColumns.length && (
                            <th className="py-2 px-2.5 font-medium text-gray-400">...</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {parsedRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                            <td className="py-2 px-2.5 text-center text-gray-400 font-mono">{idx + 1}</td>
                            {previewColumns.map(col => {
                              const val = row[col.key]
                              const isMissing = col.required && (val === '' || val === null || val === undefined)
                              return (
                                <td
                                  key={col.key}
                                  className={`py-2 px-2.5 truncate max-w-[180px] ${
                                    isMissing ? 'bg-red-50 text-red-600 font-medium' : ''
                                  }`}
                                >
                                  {val !== undefined && val !== null && String(val) !== '' ? (
                                    typeof val === 'boolean' ? (
                                      val ? '是' : '否'
                                    ) : (
                                      String(val)
                                    )
                                  ) : (
                                    <span className="text-gray-300 dark:text-gray-600">—</span>
                                  )}
                                </td>
                              )
                            })}
                            {columns.length > previewColumns.length && (
                              <td className="py-2 px-2.5 text-gray-400">...</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validation Warnings */}
          {validationErrors.length > 0 && !result && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs space-y-1.5 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>資料檢查提示（共 {validationErrors.length} 則）</span>
              </div>
              <ul className="max-h-24 list-disc space-y-0.5 overflow-y-auto pl-5 text-gray-600 dark:text-gray-400">
                {validationErrors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err.message}</li>
                ))}
                {validationErrors.length > 5 && (
                  <li className="text-gray-400">…以及其餘 {validationErrors.length - 5} 則提醒</li>
                )}
              </ul>
            </div>
          )}

          {/* Server Error Message */}
          {serverError && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">匯入錯誤</p>
                <p className="mt-0.5">{serverError}</p>
              </div>
            </div>
          )}

          {/* Import Result Feedback */}
          {result && (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                    批次匯入完成！
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {result.inserted !== undefined && `新增 ${result.inserted} 筆`}
                    {result.updated !== undefined && `、更新 ${result.updated} 筆`}
                    {result.imported !== undefined && !result.inserted && !result.updated && `成功寫入 ${result.imported} 筆`}
                    {result.skipped !== undefined && result.skipped > 0 && `、略過 ${result.skipped} 筆`}
                  </p>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-gray-800 space-y-1">
                  <div className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>部分未匯入項目（{result.errors.length} 筆）：</span>
                  </div>
                  <ul className="max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-gray-600 dark:text-gray-400">
                    {result.errors.map((er, idx) => (
                      <li key={idx}>
                        {er.line > 0 ? `第 ${er.line} 列：` : ''}
                        {er.reason || er.message || '格式不符'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t px-6 py-3.5 bg-gray-50/70 rounded-b-xl dark:border-gray-800 dark:bg-gray-900/70">
          <div>
            {parsedRows.length > 0 && !result && (
              <span className="text-xs text-gray-500">
                已載入 <b>{parsedRows.length}</b> 筆資料準備匯入
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              {result ? '關閉' : '取消'}
            </Button>
            {!result ? (
              <Button
                size="sm"
                className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleConfirmSubmit}
                disabled={submitting || parsedRows.length === 0 || parsing}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    寫入中…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    確認匯入 / 更新 ({parsedRows.length})
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs"
                onClick={() => {
                  setResult(null)
                  setFile(null)
                  setParsedRows([])
                  setActiveTab('upload')
                }}
              >
                繼續匯入其他檔案
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
