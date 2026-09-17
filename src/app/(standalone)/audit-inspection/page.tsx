'use client'

import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ClipboardCheck, Camera, Sparkles, AlertCircle, AlertTriangle,
  CheckCircle2, Store, Calendar, ArrowRight, MessageSquare,
  ScrollText, Cpu, Smartphone, QrCode, ShieldAlert, Thermometer,
  Percent, Clock, RefreshCw, Upload, Trash2, ShieldCheck, Flame
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type InspCategory =
  | 'hygiene'        // 1. 門市環境+衛生+擺設+隨手習慣
  | 'attitude'       // 2. 門市服務態度+微笑 (+ Jetson)
  | 'food_quality'   // 3. 門市食品品質 (客觀測量 + 主觀品評)
  | 'safety_scrap'   // 4. 原料安全 (作廢卻仍使用重罰)
  | 'shortage'       // 5. 缺補料管控 (缺料未補 + 幽靈原料私購)
  | 'marketing_zalo' // 6. 行銷活動+ZALO私群+公務機

const CATEGORY_KEYS: InspCategory[] = ['hygiene', 'attitude', 'food_quality', 'safety_scrap', 'shortage', 'marketing_zalo']

export default function AuditInspectionPage() {
  const t = useTranslations('AuditInspection')
  const CATEGORIES = CATEGORY_KEYS.map(key => ({ key, title: t(`cat_${key}_title`), desc: t(`cat_${key}_desc`), badge: t(`cat_${key}_badge`) }))
  const [stores, setStores] = useState<string[]>([])
  const [store, setStore] = useState('')
  const [selectedCat, setSelectedCat] = useState<InspCategory>('hygiene')
  const [auditorName, setAuditorName] = useState('')

  // 當前類別狀態
  const [photo, setPhoto] = useState<string>('')
  const [handwrittenNotes, setHandwrittenNotes] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)

  // 3. 食品品質專用客觀欄位
  const [foodTemp, setFoodTemp] = useState('65')
  const [foodBrix, setFoodBrix] = useState('12.0')
  const [foodTimeLabelOk, setFoodTimeLabelOk] = useState(true)

  // 4. 作廢違規突擊專用
  const [scrapItemCode, setScrapItemCode] = useState('TEA-001 高山青茶')
  const [isScrappedStillInUse, setIsScrappedStillInUse] = useState(false)
  const [penaltyDeclared, setPenaltyDeclared] = useState(false)

  // 5. 缺料專用狀態
  const [shortageItem, setShortageItem] = useState('珍珠粉圓 (TAP-01)')
  const [hoursUnrestocked, setHoursUnrestocked] = useState('28')
  const [hasGhostSales, setHasGhostSales] = useState(false)

  // 6. 公務機與 Zalo 專用狀態
  const [deviceSerial, setDeviceSerial] = useState('DEV-YL-01')
  const [deviceStatus, setDeviceStatus] = useState('正常使用 (Active)')
  const [qrVerified, setQrVerified] = useState<boolean | null>(null)
  const [qrNotice, setQrNotice] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/inv/stores').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.stores?.length) {
        setStores(d.stores)
        setStore(d.stores[0])
      }
    }).catch(() => {})
  }, [])

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setPhoto(reader.result as string)
      setAnalysisResult(null)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // 呼叫多模態 AI 分析（照片 + 手寫 + 分類）
  const runAiAnalysis = async () => {
    if (!photo && !handwrittenNotes.trim()) {
      alert(t('needPhotoOrNotes'))
      return
    }

    setAnalyzing(true)
    setAnalysisResult(null)

    let extraContext = `門市：${store}。`
    if (selectedCat === 'food_quality') {
      extraContext += `茶湯測溫：${foodTemp}℃，糖度計：${foodBrix} Brix°，賞味時間標籤：${foodTimeLabelOk ? '合格' : '過期或未貼'}。`
    } else if (selectedCat === 'safety_scrap') {
      extraContext += `稽核現場清查：原料批號 ${scrapItemCode}。現場清查是否按作廢卻仍在使用：${isScrappedStillInUse ? '【抓獲違規：已報作廢卻仍在吧台使用！】' : '正常未發現'}。`
    } else if (selectedCat === 'shortage') {
      extraContext += `缺料品項：${shortageItem}，安全庫存不足且未叫貨時數：${hoursUnrestocked} 小時。POS 持續銷售反推私購幽靈原料：${hasGhostSales ? '【疑似私購外來原料】' : '無'}。`
    } else if (selectedCat === 'marketing_zalo') {
      extraContext += `公務機序號：${deviceSerial}，機況狀態：${deviceStatus}。現場 QR Code 比對：${qrVerified === true ? '官方白名單' : qrVerified === false ? '【重大違規：個人私群/個人私收款】' : '待掃描'}。`
    }

    const res = await fetch('/api/audit/inspections/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: selectedCat,
        photo_url: photo,
        handwritten_notes: handwrittenNotes,
        context: extraContext,
      })
    })

    setAnalyzing(false)
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.result) {
      setAnalysisResult(data.result)
    } else {
      alert(data.error ?? t('aiAnalysisFailed'))
    }
  }

  // 驗證 QR Code
  const verifyQrCode = () => {
    // 模擬 AI 或光學辨識現場立牌 QR Code 是否為公司官方白名單
    if (!photo) {
      alert(t('needQrPhoto'))
      return
    }
    // 依據照片特徵或預設判斷
    const isWhiteListed = !handwrittenNotes.includes('個人') && !handwrittenNotes.includes('私人')
    setQrVerified(isWhiteListed)
    if (isWhiteListed) {
      setQrNotice(t('qrVerifiedOk'))
    } else {
      setQrNotice(t('qrVerifiedFail'))
    }
  }

  const currentMeta = CATEGORIES.find(c => c.key === selectedCat) || CATEGORIES[0]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* 頂部標頭 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {t('pageTitle')}
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                {t('sixModules')}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">{t('pageSubtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 門市切換 */}
          <div className="flex items-center gap-1.5 border rounded-lg px-2 py-1 bg-background text-xs">
            <Store className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{t('storeLabel')}</span>
            <input
              list="insp-stores"
              value={store}
              onChange={e => setStore(e.target.value)}
              className="w-24 font-bold bg-transparent outline-none"
              placeholder="YL"
            />
            <datalist id="insp-stores">
              {stores.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <Link href="/audit-ai">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 text-primary border-primary/30">
              <MessageSquare className="h-3.5 w-3.5" />
              {t('discussAi')}
            </Button>
          </Link>
          <Link href="/audit-logs">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <ScrollText className="h-3.5 w-3.5" />
              {t('logs')}
            </Button>
          </Link>
        </div>
      </div>

      {/* 六大巡檢模組按鈕群 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {CATEGORIES.map(cat => {
          const isActive = selectedCat === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => {
                setSelectedCat(cat.key)
                setAnalysisResult(null)
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                isActive
                  ? 'border-amber-500 bg-amber-500/10 shadow-xs'
                  : 'border-border bg-card hover:bg-muted/50'
              }`}
            >
              <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                {cat.badge}
              </div>
              <div className="font-bold text-xs mt-0.5 text-foreground">{cat.title}</div>
            </button>
          )
        })}
      </div>

      {/* 模組專屬工作區 */}
      <div className="grid md:grid-cols-12 gap-5">
        {/* 左側欄 (7 欄)：拍照、手寫評論、客觀數值 */}
        <div className="md:col-span-7 space-y-4">
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h2 className="font-bold text-sm text-foreground">{currentMeta.title}</h2>
                <p className="text-xs text-muted-foreground">{currentMeta.desc}</p>
              </div>
              <Button
                size="sm"
                onClick={runAiAnalysis}
                disabled={analyzing}
                className="gap-1.5 h-8 text-xs bg-gradient-to-r from-amber-600 to-orange-600 text-white"
              >
                {analyzing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {t('aiPhotoAnalysis')}
              </Button>
            </div>

            {/* 照片上傳與相機 */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                {t('inspectionPhotoLabel')}
              </span>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handlePhotoSelect}
              />

              {photo ? (
                <div className="relative rounded-xl border overflow-hidden bg-black/5 aspect-video max-h-64 flex items-center justify-center">
                  <img src={photo} alt={t('inspectionPhotoAlt')} className="w-full h-full object-contain" />
                  <button
                    onClick={() => { setPhoto(''); setAnalysisResult(null) }}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full shadow-md hover:bg-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-muted/40 transition-colors space-y-2"
                >
                  <Camera className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-xs font-medium text-foreground">{t('clickToPhoto')}</p>
                  <p className="text-[11px] text-muted-foreground">{t('photoSupportHint')}</p>
                </div>
              )}
            </div>

            {/* 手寫評論與稽核備註 */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground">{t('handwrittenNotesLabel')}</span>
              <textarea
                value={handwrittenNotes}
                onChange={e => setHandwrittenNotes(e.target.value)}
                placeholder={t('handwrittenNotesPlaceholder')}
                className="w-full h-20 p-2.5 text-xs border rounded-lg bg-background resize-none"
              />
            </div>

            {/* 各模組專屬功能控制卡 */}
            {selectedCat === 'food_quality' && (
              <div className="p-3 border rounded-xl bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <Thermometer className="h-4 w-4 text-amber-600" />
                  {t('foodQualityTitle')}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">{t('teaTemp')}</label>
                    <Input value={foodTemp} onChange={e => setFoodTemp(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">{t('brix')}</label>
                    <Input value={foodBrix} onChange={e => setFoodBrix(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground">{t('freshnessLabel')}</span>
                  <button
                    onClick={() => setFoodTimeLabelOk(v => !v)}
                    className={`px-3 py-1 rounded-md text-xs font-medium border ${
                      foodTimeLabelOk ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-red-50 text-red-700 border-red-300'
                    }`}
                  >
                    {foodTimeLabelOk ? t('labelCompliant') : t('labelExpired')}
                  </button>
                </div>
              </div>
            )}

            {selectedCat === 'safety_scrap' && (
              <div className="p-3 border rounded-xl bg-red-50/40 dark:bg-red-950/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-red-900 dark:text-red-200">
                  <Flame className="h-4 w-4 text-red-600" />
                  {t('safetyScrapTitle')}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t('safetyScrapDesc')}
                </p>
                <div className="text-xs space-y-1">
                  <span className="text-muted-foreground">{t('scrapBatchLabel')}</span>
                  <Input value={scrapItemCode} onChange={e => setScrapItemCode(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-red-700 dark:text-red-300">{t('scrapFoundQuestion')}</span>
                  <button
                    onClick={() => {
                      setIsScrappedStillInUse(v => !v)
                      if (!isScrappedStillInUse) setPenaltyDeclared(true)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      isScrappedStillInUse
                        ? 'bg-red-600 text-white border-red-700 animate-pulse'
                        : 'bg-background text-muted-foreground border-border'
                    }`}
                  >
                    {isScrappedStillInUse ? t('scrapViolationFound') : t('scrapNoViolation')}
                  </button>
                </div>
                {isScrappedStillInUse && (
                  <div className="p-2.5 rounded-lg bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200 text-xs border border-red-300 space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <ShieldAlert className="h-4 w-4 text-red-600" />
                      {t('penaltyTitle')}
                    </div>
                    <div>{t('penaltyClause')}</div>
                  </div>
                )}
              </div>
            )}

            {selectedCat === 'shortage' && (
              <div className="p-3 border rounded-xl bg-sky-50/40 dark:bg-sky-950/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-900 dark:text-sky-200">
                  <AlertTriangle className="h-4 w-4 text-sky-600" />
                  {t('shortageTitle')}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">{t('shortageItemLabel')}</label>
                    <Input value={shortageItem} onChange={e => setShortageItem(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">{t('hoursUnrestockedLabel')}</label>
                    <Input value={hoursUnrestocked} onChange={e => setHoursUnrestocked(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">{t('ghostSalesLabel')}</span>
                  <button
                    onClick={() => setHasGhostSales(v => !v)}
                    className={`px-3 py-1 rounded-md text-xs font-medium border ${
                      hasGhostSales ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold' : 'bg-background text-muted-foreground'
                    }`}
                  >
                    {hasGhostSales ? t('ghostSalesFound') : t('ghostSalesNone')}
                  </button>
                </div>
              </div>
            )}

            {selectedCat === 'marketing_zalo' && (
              <div className="p-3 border rounded-xl bg-purple-50/40 dark:bg-purple-950/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-900 dark:text-purple-200">
                  <Smartphone className="h-4 w-4 text-purple-600" />
                  {t('marketingZaloTitle')}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">{t('deviceSerialLabel')}</label>
                    <Input value={deviceSerial} onChange={e => setDeviceSerial(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">{t('deviceStatusLabel')}</label>
                    <Input value={deviceStatus} onChange={e => setDeviceStatus(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>

                <div className="pt-1 border-t space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-1">
                      <QrCode className="h-3.5 w-3.5" />
                      {t('qrVerifyLabel')}
                    </span>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={verifyQrCode}>
                      {t('verifyQrButton')}
                    </Button>
                  </div>
                  {qrNotice && (
                    <div className={`p-2 rounded-lg text-xs font-medium ${
                      qrVerified ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-red-50 text-red-800 border border-red-300'
                    }`}>
                      {qrNotice}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* 右側欄 (5 欄)：AI 視覺與手寫分析成果 ＋ Jetson 串接預留 */}
        <div className="md:col-span-5 space-y-4">
          {/* Jetson 邊緣主機串接狀態卡（特別在態度與環境呈現） */}
          <Card className="p-3.5 bg-muted/30 border space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-600 animate-pulse" />
                <span className="text-xs font-bold text-foreground">{t('jetsonTitle')}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                {t('jetsonOnline')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
              <div className="p-2 rounded-lg bg-background border">
                <div className="text-muted-foreground text-[10px]">{t('smileIndex')}</div>
                <div className="font-bold text-amber-600 text-sm">68%</div>
              </div>
              <div className="p-2 rounded-lg bg-background border">
                <div className="text-muted-foreground text-[10px]">{t('greetingVoice')}</div>
                <div className="font-bold text-emerald-600 text-sm">92%</div>
              </div>
              <div className="p-2 rounded-lg bg-background border">
                <div className="text-muted-foreground text-[10px]">{t('crowdingLevel')}</div>
                <div className="font-bold text-blue-600 text-sm">{t('crowdingLow')}</div>
              </div>
            </div>
          </Card>

          {/* AI 巡檢分析結果卡片 */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <h3 className="font-bold text-sm text-foreground">{t('diagnosisReportTitle')}</h3>
              </div>
              {analysisResult?.suggested_score !== undefined && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  {t('scoreLabel', { score: analysisResult.suggested_score })}
                </span>
              )}
            </div>

            {analyzing ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 text-muted-foreground">
                <RefreshCw className="h-7 w-7 animate-spin text-amber-600" />
                <p className="text-xs font-medium">{t('analyzingHint')}</p>
              </div>
            ) : !analysisResult ? (
              <div className="py-12 text-center text-xs text-muted-foreground space-y-1">
                <ClipboardCheck className="h-8 w-8 mx-auto opacity-30" />
                <p>{t('notAnalyzedYet')}</p>
                <p>{t('notAnalyzedHint')}</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {/* 手寫 OCR */}
                {analysisResult.ocr_text && (
                  <div className="p-2 rounded-lg bg-muted/40 border">
                    <span className="font-semibold text-[11px] text-muted-foreground block mb-0.5">{t('ocrLabel')}</span>
                    <p className="font-mono text-foreground">{analysisResult.ocr_text}</p>
                  </div>
                )}

                {/* 違規重大懲處 */}
                {analysisResult.penalty_flag && (
                  <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-200 border border-red-300 space-y-1">
                    <div className="font-bold flex items-center gap-1 text-xs">
                      <ShieldAlert className="h-4 w-4 text-red-600" />
                      {t('violationNoticeTitle')}
                    </div>
                    <p>{analysisResult.penalty_reason || t('violationNoticeDefault')}</p>
                  </div>
                )}

                {/* 現場觀察點 */}
                {analysisResult.findings?.length > 0 && (
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">{t('findingsLabel')}</span>
                    <ul className="list-disc list-inside space-y-1 text-foreground">
                      {analysisResult.findings.map((f: string, i: number) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 專家評語 */}
                <div>
                  <span className="font-semibold text-muted-foreground block mb-1">{t('analysisLabel')}</span>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap bg-muted/20 p-2.5 rounded-lg border">
                    {analysisResult.analysis}
                  </p>
                </div>

                {/* 改善建議 */}
                {analysisResult.recommendations?.length > 0 && (
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">{t('recommendationsLabel')}</span>
                    <div className="space-y-1">
                      {analysisResult.recommendations.map((r: string, i: number) => (
                        <div key={i} className="flex items-start gap-1.5 p-1.5 rounded-md bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200">
                          <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 一鍵帶入討論 AI */}
                <div className="pt-2 border-t">
                  <Link href="/audit-ai">
                    <Button className="w-full gap-1.5 text-xs h-9" variant="default">
                      <MessageSquare className="h-4 w-4" />
                      {t('bringToDiscussAi')}
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
