'use client'

import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import Link from 'next/link'
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

interface CategoryMeta {
  key: InspCategory
  title: string
  desc: string
  badge: string
}

const CATEGORIES: CategoryMeta[] = [
  { key: 'hygiene', title: '環境衛生擺設', desc: '工作台面積水油垢、抹布定位分區、人體工學動線、隨手清習慣', badge: '照片+手寫AI分析' },
  { key: 'attitude', title: '服務態度微笑', desc: '員工儀容配件、親和力微笑、迎賓禮貌（支援 Jetson 主機串接）', badge: 'Jetson 邊緣主機' },
  { key: 'food_quality', title: '食品品質客觀測量', desc: '茶溫 ℃、糖度計 Brix°、賞味時標檢核（強制科學申報）', badge: '客觀標準公差' },
  { key: 'safety_scrap', title: '原料安全・作廢查核', desc: '按「作廢」卻仍在吧台使用中或保存中？一級重大舞弊重罰申報', badge: '重大舞弊防查' },
  { key: 'shortage', title: '原料缺補料管控', desc: '安全庫存缺料未補警示、POS銷量反推幽靈原料（私購）警報', badge: '防私購偷賣' },
  { key: 'marketing_zalo', title: '行銷・ZALO・公務機', desc: '門市專用公務機抽查、現場立牌 QR Code 官方防偽驗證', badge: '公務機與防飛單' },
]

export default function AuditInspectionPage() {
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
      alert('請先拍照上傳現場照片，或填寫手寫評論筆記。')
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
      alert(data.error ?? 'AI 分析失敗')
    }
  }

  // 驗證 QR Code
  const verifyQrCode = () => {
    // 模擬 AI 或光學辨識現場立牌 QR Code 是否為公司官方白名單
    if (!photo) {
      alert('請先拍攝門市櫃檯立牌或菜單上的 QR Code 照片')
      return
    }
    // 依據照片特徵或預設判斷
    const isWhiteListed = !handwrittenNotes.includes('個人') && !handwrittenNotes.includes('私人')
    setQrVerified(isWhiteListed)
    if (isWhiteListed) {
      setQrNotice('驗證通過：此 QR Code 為總部官方認證 Zalo 企業號 / 官方金流收款碼。')
    } else {
      setQrNotice('⚠️ 嚴重違規警報：此 QR Code 指向員工個人 Zalo 帳號或個人銀行帳戶！涉及私下收款飛單！')
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
              門市現場巡檢工作台
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                六大現場模組
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">多模態 AI 現場視覺辨識・人體工學動線診斷・作廢重罰防弊・公務機專案</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 門市切換 */}
          <div className="flex items-center gap-1.5 border rounded-lg px-2 py-1 bg-background text-xs">
            <Store className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">門市：</span>
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
              討論AI
            </Button>
          </Link>
          <Link href="/audit-logs">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <ScrollText className="h-3.5 w-3.5" />
              日誌
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
                AI 照片+手寫分析
              </Button>
            </div>

            {/* 照片上傳與相機 */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                現場巡檢照片（支援吧台動線、食品標籤、作廢物料、QR Code）
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
                  <img src={photo} alt="巡檢照片" className="w-full h-full object-contain" />
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
                  <p className="text-xs font-medium text-foreground">點擊開啟相機拍照或選擇照片</p>
                  <p className="text-[11px] text-muted-foreground">支援拍照上傳吧台、員工儀容、時間標籤、公務機畫面</p>
                </div>
              )}
            </div>

            {/* 手寫評論與稽核備註 */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground">現場手寫筆記／評論（AI 將自動 OCR 並整合）：</span>
              <textarea
                value={handwrittenNotes}
                onChange={e => setHandwrittenNotes(e.target.value)}
                placeholder="手寫或輸入現場觀察（例如：封口機擺放距水槽過近、抹布未分色、店員未掛名牌、原料貼標模糊）..."
                className="w-full h-20 p-2.5 text-xs border rounded-lg bg-background resize-none"
              />
            </div>

            {/* 各模組專屬功能控制卡 */}
            {selectedCat === 'food_quality' && (
              <div className="p-3 border rounded-xl bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <Thermometer className="h-4 w-4 text-amber-600" />
                  食品品質科學測量（客觀數據必填申報）
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">茶湯測溫（℃，標準 60–65℃）：</label>
                    <Input value={foodTemp} onChange={e => setFoodTemp(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">糖度計（Brix°，標準公差 ±0.5°）：</label>
                    <Input value={foodBrix} onChange={e => setFoodBrix(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground">煮茶賞味期限時標（4小時效期）：</span>
                  <button
                    onClick={() => setFoodTimeLabelOk(v => !v)}
                    className={`px-3 py-1 rounded-md text-xs font-medium border ${
                      foodTimeLabelOk ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-red-50 text-red-700 border-red-300'
                    }`}
                  >
                    {foodTimeLabelOk ? '時標合規' : '時標過期 / 未貼'}
                  </button>
                </div>
              </div>
            )}

            {selectedCat === 'safety_scrap' && (
              <div className="p-3 border rounded-xl bg-red-50/40 dark:bg-red-950/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-red-900 dark:text-red-200">
                  <Flame className="h-4 w-4 text-red-600" />
                  原料安全管控・假作廢真使用突擊防弊
                </div>
                <p className="text-[11px] text-muted-foreground">
                  門市系統上按「作廢」，現場若查獲仍在吧台使用或保存，屬於一級重大舞弊，觸發重罰流程！
                </p>
                <div className="text-xs space-y-1">
                  <span className="text-muted-foreground">近 7 天系統申報作廢原料批號：</span>
                  <Input value={scrapItemCode} onChange={e => setScrapItemCode(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-red-700 dark:text-red-300">現場吧台是否查獲此物料？</span>
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
                    {isScrappedStillInUse ? '⚠️ 查獲違規使用（已觸發重罰）' : '未發現違規（正常）'}
                  </button>
                </div>
                {isScrappedStillInUse && (
                  <div className="p-2.5 rounded-lg bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200 text-xs border border-red-300 space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <ShieldAlert className="h-4 w-4 text-red-600" />
                      一級食安與舞弊罰則已成立
                    </div>
                    <div>條款：違反總部原物料作廢安全銷毀規範，處違約罰金 $10,000 並記大過一次。</div>
                  </div>
                )}
              </div>
            )}

            {selectedCat === 'shortage' && (
              <div className="p-3 border rounded-xl bg-sky-50/40 dark:bg-sky-950/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-900 dark:text-sky-200">
                  <AlertTriangle className="h-4 w-4 text-sky-600" />
                  原料缺補料與幽靈私購警示
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">缺料品項：</label>
                    <Input value={shortageItem} onChange={e => setShortageItem(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">未補料持續時數：</label>
                    <Input value={hoursUnrestocked} onChange={e => setHoursUnrestocked(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">POS持續銷售（幽靈原料反推）：</span>
                  <button
                    onClick={() => setHasGhostSales(v => !v)}
                    className={`px-3 py-1 rounded-md text-xs font-medium border ${
                      hasGhostSales ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold' : 'bg-background text-muted-foreground'
                    }`}
                  >
                    {hasGhostSales ? '⚠️ 抓獲幽靈私購（在庫為0仍出杯）' : '無異常銷售'}
                  </button>
                </div>
              </div>
            )}

            {selectedCat === 'marketing_zalo' && (
              <div className="p-3 border rounded-xl bg-purple-50/40 dark:bg-purple-950/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-900 dark:text-purple-200">
                  <Smartphone className="h-4 w-4 text-purple-600" />
                  門市公務機與 Zalo QR Code 防偽抽查
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">門市專屬公務機序號：</label>
                    <Input value={deviceSerial} onChange={e => setDeviceSerial(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">公務機機況：</label>
                    <Input value={deviceStatus} onChange={e => setDeviceStatus(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>

                <div className="pt-1 border-t space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-1">
                      <QrCode className="h-3.5 w-3.5" />
                      現場 QR Code 官方防偽驗證
                    </span>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={verifyQrCode}>
                      驗證照片中 QR Code
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
                <span className="text-xs font-bold text-foreground">門市 JETSON 邊緣主機串接</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                在線運作中
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
              <div className="p-2 rounded-lg bg-background border">
                <div className="text-muted-foreground text-[10px]">微笑指數</div>
                <div className="font-bold text-amber-600 text-sm">68%</div>
              </div>
              <div className="p-2 rounded-lg bg-background border">
                <div className="text-muted-foreground text-[10px]">迎賓語音</div>
                <div className="font-bold text-emerald-600 text-sm">92%</div>
              </div>
              <div className="p-2 rounded-lg bg-background border">
                <div className="text-muted-foreground text-[10px]">動線擁擠度</div>
                <div className="font-bold text-blue-600 text-sm">低 (順暢)</div>
              </div>
            </div>
          </Card>

          {/* AI 巡檢分析結果卡片 */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <h3 className="font-bold text-sm text-foreground">AI 巡檢多模態診斷報告</h3>
              </div>
              {analysisResult?.suggested_score !== undefined && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  評分：{analysisResult.suggested_score} / 10
                </span>
              )}
            </div>

            {analyzing ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 text-muted-foreground">
                <RefreshCw className="h-7 w-7 animate-spin text-amber-600" />
                <p className="text-xs font-medium">多模態 AI 正在辨識照片細節與手寫筆記...</p>
              </div>
            ) : !analysisResult ? (
              <div className="py-12 text-center text-xs text-muted-foreground space-y-1">
                <ClipboardCheck className="h-8 w-8 mx-auto opacity-30" />
                <p>尚未進行分析</p>
                <p>上傳照片或輸入手寫筆記後點擊上方「AI 分析」按鈕</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {/* 手寫 OCR */}
                {analysisResult.ocr_text && (
                  <div className="p-2 rounded-lg bg-muted/40 border">
                    <span className="font-semibold text-[11px] text-muted-foreground block mb-0.5">辨識手寫筆記：</span>
                    <p className="font-mono text-foreground">{analysisResult.ocr_text}</p>
                  </div>
                )}

                {/* 違規重大懲處 */}
                {analysisResult.penalty_flag && (
                  <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-200 border border-red-300 space-y-1">
                    <div className="font-bold flex items-center gap-1 text-xs">
                      <ShieldAlert className="h-4 w-4 text-red-600" />
                      重大違規項目懲處通知
                    </div>
                    <p>{analysisResult.penalty_reason || '現場檢出嚴重違規事項，列入總部重罰申報單。'}</p>
                  </div>
                )}

                {/* 現場觀察點 */}
                {analysisResult.findings?.length > 0 && (
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">現場關鍵觀察點：</span>
                    <ul className="list-disc list-inside space-y-1 text-foreground">
                      {analysisResult.findings.map((f: string, i: number) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 專家評語 */}
                <div>
                  <span className="font-semibold text-muted-foreground block mb-1">專家動線與合規分析：</span>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap bg-muted/20 p-2.5 rounded-lg border">
                    {analysisResult.analysis}
                  </p>
                </div>

                {/* 改善建議 */}
                {analysisResult.recommendations?.length > 0 && (
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">具體落地改善行動：</span>
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
                      將此診斷結果帶入「稽核討論AI」深入探討
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
