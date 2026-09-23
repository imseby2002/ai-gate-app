'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X, RotateCcw, AlertTriangle, CheckCircle2, Loader2,
  Trash2, Calendar, FileText, Database, ShieldAlert, Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

export interface ImportLogItem {
  id: string
  account_book: string
  filename: string
  imported_at: string
  total_rows: number
  success_count: number
  error_count: number
  warning_count: number
  subjects_created: number
  date_range: string
  status?: 'active' | 'reverted'
  reverted_at?: string
  errors?: any[]
}

interface MdbBatchManagementModalProps {
  open: boolean
  onClose: () => void
  accountBook?: string
  onReverted?: () => void
}

const fmt = (n: number) => Math.round(n || 0).toLocaleString('zh-TW')

export function MdbBatchManagementModal({
  open,
  onClose,
  accountBook = 'FT',
  onReverted,
}: MdbBatchManagementModalProps) {
  const [logs, setLogs] = useState<ImportLogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // 撤回單一批次之確認彈窗
  const [revertingLog, setRevertingLog] = useState<ImportLogItem | null>(null)

  // 清空全部之防呆彈窗
  const [showClearAllModal, setShowClearAllModal] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/fin/import-logs?book=${encodeURIComponent(accountBook)}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '載入匯入紀錄失敗')
      setLogs(d.logs || [])
    } catch (e: any) {
      setErr(e.message || '連線錯誤')
    } finally {
      setLoading(false)
    }
  }, [accountBook])

  useEffect(() => {
    if (open) {
      loadLogs()
      setFeedback(null)
      setErr(null)
    }
  }, [open, loadLogs])

  // 執行單一批次撤回
  const handleRevertBatch = async (log: ImportLogItem) => {
    setActionBusy(true)
    setErr(null)
    try {
      const res = await fetch(`/api/fin/import-logs?id=${log.id}&action=revert_batch`, {
        method: 'DELETE',
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '撤回失敗')
      setFeedback(d.message || `已成功撤回此批次（共清除 ${d.deleted_count} 筆單據）`)
      setRevertingLog(null)
      loadLogs()
      onReverted?.()
    } catch (e: any) {
      setErr(e.message || '撤回失敗')
    } finally {
      setActionBusy(false)
    }
  }

  // 執行全數 MDB 交易清空
  const handleClearAll = async () => {
    if (confirmInput.trim().toUpperCase() !== 'DELETE') {
      alert('請輸入 DELETE 確認清空')
      return
    }
    setActionBusy(true)
    setErr(null)
    try {
      const res = await fetch(`/api/fin/import-logs?action=revert_all`, {
        method: 'DELETE',
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '清空失敗')
      setFeedback(d.message || `已成功清空所有 MDB 歷史資料（共清除 ${d.deleted_count} 筆單據）`)
      setShowClearAllModal(false)
      setConfirmInput('')
      loadLogs()
      onReverted?.()
    } catch (e: any) {
      setErr(e.message || '清空失敗')
    } finally {
      setActionBusy(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" onClick={onClose}>
        <Card className="w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
          {/* 標題列 */}
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">MDB 匯入歷史與批次撤回管理</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  若匯入資料有誤或欲重新倒帳，可一鍵安全撤回整批流水帳（手動建立之帳目 100% 完整保留）。
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 提示回饋 */}
          {feedback && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in-50">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{feedback}</span>
            </div>
          )}

          {err && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {/* 功能按鈕列 */}
          <div className="flex items-center justify-between gap-2 p-3 bg-muted/30 rounded-xl border">
            <span className="text-xs text-muted-foreground">
              帳本代碼：<b className="text-foreground">{accountBook}</b>（共 {logs.length} 次匯入紀錄）
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400 font-semibold"
              onClick={() => {
                setConfirmInput('')
                setShowClearAllModal(true)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空所有 MDB 匯入流水帳
            </Button>
          </div>

          {/* 紀錄清單 */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">正在載入匯入批次紀錄…</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 border rounded-xl bg-card/40 border-dashed space-y-2">
              <Database className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <div className="text-sm font-medium text-muted-foreground">尚無任何 MDB 匯入歷史紀錄</div>
              <p className="text-xs text-muted-foreground/60">可點選出納頁面「匯入記帳檔 (.mdb)」導入帳務小管家資料庫。</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => {
                const isReverted = log.status === 'reverted'
                const importedDateStr = log.imported_at ? new Date(log.imported_at).toLocaleString('zh-TW', { hour12: false }) : '—'

                return (
                  <div
                    key={log.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isReverted
                        ? 'bg-muted/20 border-border/50 opacity-60'
                        : 'bg-card border-border hover:border-primary/40 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{log.filename || 'MymoneyData.mdb'}</span>
                        <Badge variant={isReverted ? 'secondary' : 'default'} className="text-[10px] h-5">
                          {isReverted ? '已撤回 (Reverted)' : '生效中 (Active)'}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {importedDateStr}
                        </span>
                      </div>

                      {!isReverted && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 self-end sm:self-auto font-medium"
                          onClick={() => setRevertingLog(log)}
                        >
                          <RotateCcw className="h-3 w-3" />
                          撤回此批資料
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5 text-xs text-muted-foreground">
                      <div>
                        匯入筆數：
                        <b className={`font-semibold ${isReverted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {fmt(log.success_count)} 筆
                        </b>
                      </div>
                      <div>
                        建置科目：<span className="text-foreground font-medium">{log.subjects_created} 個</span>
                      </div>
                      <div className="col-span-2">
                        涵蓋區間：<span className="text-foreground font-mono text-[11px]">{log.date_range || '未記錄'}</span>
                      </div>
                    </div>

                    {isReverted && log.reverted_at && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-2 bg-rose-50/50 dark:bg-rose-950/20 p-1.5 rounded">
                        ⚠️ 此批次已於 {new Date(log.reverted_at).toLocaleString('zh-TW', { hour12: false })} 撤回，所有流水帳已全數移除。
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 底部按鈕 */}
          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" size="sm" onClick={onClose}>
              關閉視窗
            </Button>
          </div>
        </Card>
      </div>

      {/* 彈窗 2：單一批次撤回二次確認 Modal */}
      {revertingLog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4" onClick={() => setRevertingLog(null)}>
          <Card className="w-full max-w-md p-5 space-y-4 shadow-2xl border-rose-200 dark:border-rose-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="font-bold text-base">確認撤回此批 MDB 資料？</h4>
            </div>

            <div className="text-xs space-y-2 text-muted-foreground leading-relaxed">
              <p>
                您即將撤回於 <b>{revertingLog.imported_at ? new Date(revertingLog.imported_at).toLocaleString('zh-TW', { hour12: false }) : ''}</b> 匯入之 <b>{revertingLog.filename}</b>。
              </p>
              <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                <div>• 將完全刪除該批次之 <b>{fmt(revertingLog.success_count)}</b> 筆流水單據。</div>
                <div>• 日期區間：{revertingLog.date_range || '—'}</div>
                <div className="text-emerald-600 font-medium">• 您在系統中手工建立的所有出納記錄將<b>完整保留，不受影響</b>。</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setRevertingLog(null)} disabled={actionBusy}>
                取消
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold"
                onClick={() => handleRevertBatch(revertingLog)}
                disabled={actionBusy}
              >
                {actionBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                確認撤回清除
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 彈窗 3：清空所有 MDB 歷史單據防呆確認 Modal */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowClearAllModal(false)}>
          <Card className="w-full max-w-md p-5 space-y-4 shadow-2xl border-rose-400" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="h-5 w-5" />
              <h4 className="font-bold text-base">高防護警告：清空全部 MDB 匯入交易</h4>
            </div>

            <div className="text-xs space-y-2 text-muted-foreground leading-relaxed">
              <p className="text-foreground font-medium">
                此操作將自出納流水帳中，清除<b>所有由 MDB 匯入的交易單據</b>（包含所有批次）。
              </p>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg text-rose-800 dark:text-rose-300 space-y-1">
                <div>⚠️ 此操作不可撤銷，請確認您欲完全乾淨重整帳本。</div>
                <div>✅ 手動建立的收支單據與已建立的科目樹將繼續保留。</div>
              </div>
              <p>
                為避免誤觸，請在下方輸入 <b className="text-rose-600 font-mono">DELETE</b> 確認執行：
              </p>
              <Input
                value={confirmInput}
                onChange={e => setConfirmInput(e.target.value)}
                placeholder="輸入 DELETE"
                className="h-9 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowClearAllModal(false)} disabled={actionBusy}>
                取消
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold"
                onClick={handleClearAll}
                disabled={actionBusy || confirmInput.trim().toUpperCase() !== 'DELETE'}
              >
                {actionBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                確認清空全部 MDB 單據
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
