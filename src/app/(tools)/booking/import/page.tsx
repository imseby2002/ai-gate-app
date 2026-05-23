'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Download, Link2, FileText, CheckCircle, Loader2, AlertCircle,
  ChevronRight, BedDouble, Wifi, MapPin, Clock, Users,
} from 'lucide-react'

const PLATFORMS = [
  { id: 'booking_com', label: 'Booking.com', color: 'bg-blue-600', hint: 'https://www.booking.com/hotel/...' },
  { id: 'agoda',       label: 'Agoda',       color: 'bg-rose-500', hint: 'https://www.agoda.com/...' },
  { id: 'airbnb',      label: 'Airbnb',      color: 'bg-orange-500', hint: 'https://www.airbnb.com/rooms/...' },
  { id: 'other',       label: '其他平台',    color: 'bg-gray-500', hint: '' },
]

interface ParsedRoom { name: string; description: string | null; max_guests: number; base_price: number | null }
interface ParsedData {
  name: string; description: string | null; address: string | null; city: string | null
  phone: string | null; email: string | null; check_in_time: string | null; check_out_time: string | null
  min_nights: number; house_rules: string | null; amenities: string[]; rooms: ParsedRoom[]
}

type Step = 'input' | 'parsing' | 'preview' | 'importing' | 'done'

export default function ImportPage() {
  const router = useRouter()
  const [platform, setPlatform]     = useState('booking_com')
  const [url, setUrl]               = useState('')
  const [pastedText, setPastedText] = useState('')
  const [inputMode, setInputMode]   = useState<'url' | 'text'>('url')
  const [step, setStep]             = useState<Step>('input')
  const [error, setError]           = useState('')
  const [fetchFailed, setFetchFailed] = useState(false)
  const [parsed, setParsed]         = useState<ParsedData | null>(null)

  async function startParse() {
    setError(''); setFetchFailed(false); setStep('parsing')
    try {
      const res = await fetch('/api/booking/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputMode === 'url' ? url : '', text: inputMode === 'text' ? pastedText : '', platform }),
      })
      const d = await res.json()
      if (!res.ok) {
        setFetchFailed(d.fetch_failed ?? false)
        setError(d.error ?? '分析失敗')
        setStep('input')
        return
      }
      setParsed(d.parsed)
      setStep('preview')
    } catch {
      setError('網路錯誤，請重試')
      setStep('input')
    }
  }

  async function doImport() {
    if (!parsed) return
    setStep('importing')
    try {
      // 1. Save profile
      await fetch('/api/booking/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:            parsed.name ?? '',
          description:     parsed.description ?? '',
          address:         parsed.address ?? '',
          city:            parsed.city ?? '',
          phone:           parsed.phone ?? '',
          email:           parsed.email ?? '',
          check_in_time:   parsed.check_in_time ?? '15:00',
          check_out_time:  parsed.check_out_time ?? '11:00',
          min_nights:      parsed.min_nights ?? 1,
          house_rules:     parsed.house_rules ?? '',
        }),
      })

      // 2. Create room types
      for (const room of parsed.rooms ?? []) {
        await fetch('/api/booking/properties', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:        room.name,
            description: room.description ?? '',
            max_guests:  room.max_guests ?? 2,
            base_price:  room.base_price ?? null,
            amenities:   parsed.amenities ?? [],
          }),
        })
      }

      // If no rooms, create a default one
      if ((parsed.rooms ?? []).length === 0) {
        await fetch('/api/booking/properties', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: parsed.name ?? '標準房',
            description: '',
            max_guests: 2,
            amenities: parsed.amenities ?? [],
          }),
        })
      }

      setStep('done')
    } catch {
      setError('匯入失敗，請重試')
      setStep('preview')
    }
  }

  const selectedPlatform = PLATFORMS.find(p => p.id === platform)

  return (
    <div className="p-4 md:p-6 pb-16 max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Download className="h-5 w-5 text-indigo-600" /> 從 OTA 匯入民宿資料
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">將 Booking.com / Agoda 等平台上的民宿資料，一鍵匯入到訂房系統</p>
      </div>

      {step === 'done' ? (
        <div className="bg-white rounded-2xl border p-8 text-center space-y-4">
          <CheckCircle className="h-14 w-14 text-emerald-500 mx-auto" />
          <h2 className="text-lg font-bold text-gray-900">匯入完成！</h2>
          <p className="text-sm text-gray-500">民宿資料及房型已建立，請前往各頁面確認並補充細節。</p>
          <div className="flex gap-3 justify-center pt-2">
            <button onClick={() => router.push('/booking/profile')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
              查看民宿資料
            </button>
            <button onClick={() => router.push('/booking/properties')}
              className="px-4 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">
              查看房型
            </button>
          </div>
        </div>
      ) : step === 'preview' && parsed ? (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-emerald-800">
            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>AI 已解析完成，請確認以下資料後點擊「確認匯入」</span>
          </div>

          {/* Profile preview */}
          <div className="bg-white rounded-xl border p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 text-base">{parsed.name || '（未取得名稱）'}</h2>

            {parsed.description && (
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{parsed.description}</p>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              {parsed.address && (
                <div className="flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-gray-400" />
                  <span>{parsed.address}{parsed.city ? `，${parsed.city}` : ''}</span>
                </div>
              )}
              {parsed.phone && (
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">📞</span> {parsed.phone}
                </div>
              )}
              {parsed.check_in_time && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  入住 {parsed.check_in_time} 後
                </div>
              )}
              {parsed.check_out_time && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  退房 {parsed.check_out_time} 前
                </div>
              )}
              {parsed.min_nights > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">🌙</span> 最少住 {parsed.min_nights} 晚
                </div>
              )}
            </div>

            {parsed.amenities.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1.5">設施（共 {parsed.amenities.length} 項）</div>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.amenities.slice(0, 20).map(a => (
                    <span key={a} className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Wifi className="h-2.5 w-2.5" />{a}
                    </span>
                  ))}
                  {parsed.amenities.length > 20 && (
                    <span className="text-[11px] text-gray-400">+{parsed.amenities.length - 20} 更多</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Rooms preview */}
          {parsed.rooms.length > 0 && (
            <div className="bg-white rounded-xl border p-5 space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                <BedDouble className="h-4 w-4 text-indigo-500" /> 房型（{parsed.rooms.length} 種）
              </h3>
              <div className="space-y-2">
                {parsed.rooms.map((r, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900">{r.name}</div>
                      {r.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.description}</p>}
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{r.max_guests} 人</span>
                      </div>
                    </div>
                    {r.base_price && (
                      <div className="shrink-0 text-right">
                        <div className="font-semibold text-indigo-600 text-sm">NT$ {r.base_price.toLocaleString()}</div>
                        <div className="text-[10px] text-gray-400">/ 晚</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsed.house_rules && (
            <div className="bg-white rounded-xl border p-5 space-y-2">
              <h3 className="font-semibold text-gray-900 text-sm">住宿規則</h3>
              <p className="text-xs text-gray-600 leading-relaxed line-clamp-6">{parsed.house_rules}</p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
            匯入後可前往「民宿資料」和「房型管理」頁面補充照片、定價等細節。
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('input')}
              className="flex-1 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">
              重新輸入
            </button>
            <button onClick={doImport} disabled={step as string === 'importing'}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {step as string === 'importing' ? <><Loader2 className="h-4 w-4 animate-spin" /> 匯入中…</> : <>確認匯入 <ChevronRight className="h-4 w-4" /></>}
            </button>
          </div>
        </div>
      ) : (
        /* Input step */
        <div className="space-y-5">
          {/* Platform selector */}
          <div className="bg-white rounded-xl border p-4 sm:p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">選擇來源平台</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => setPlatform(p.id)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-all
                    ${platform === p.id ? `${p.color} text-white border-transparent` : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input mode */}
          <div className="bg-white rounded-xl border p-4 sm:p-5 space-y-4">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              <button onClick={() => setInputMode('url')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${inputMode === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                <Link2 className="h-3.5 w-3.5" /> 貼上網址
              </button>
              <button onClick={() => setInputMode('text')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${inputMode === 'text' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                <FileText className="h-3.5 w-3.5" /> 貼上文字
              </button>
            </div>

            {inputMode === 'url' ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">民宿頁面網址</label>
                <input value={url} onChange={e => setUrl(e.target.value)}
                  placeholder={selectedPlatform?.hint ?? 'https://...'}
                  className="w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <p className="text-xs text-gray-400">
                  系統將嘗試自動擷取頁面內容。若平台有防爬蟲機制，請改用「貼上文字」方式。
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">
                  複製民宿頁面全文（Ctrl+A 全選 → Ctrl+C 複製 → 貼上）
                </label>
                <textarea value={pastedText} onChange={e => setPastedText(e.target.value)}
                  rows={8} placeholder="將 Booking.com / Agoda 民宿頁面的文字內容貼在這裡…"
                  className="w-full text-sm border rounded-xl px-3 py-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" />
                <p className="text-xs text-gray-400">
                  提示：在瀏覽器開啟您的民宿頁面 → Ctrl+A 全選 → Ctrl+C 複製 → 貼上此處
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p>{error}</p>
                {fetchFailed && (
                  <p className="mt-1 text-xs text-rose-600">
                    建議改用「貼上文字」方式：開啟您的民宿頁面 → Ctrl+A → Ctrl+C → 切換到「貼上文字」模式貼上
                  </p>
                )}
              </div>
            </div>
          )}

          <button
            onClick={startParse}
            disabled={step === 'parsing' || (inputMode === 'url' ? !url.trim() : !pastedText.trim())}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {step === 'parsing' ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> AI 解析中，請稍候…</>
            ) : (
              <><Download className="h-4 w-4" /> 開始分析並匯入</>
            )}
          </button>

          {/* How it works */}
          <div className="bg-gray-50 rounded-xl border p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-gray-600">運作方式</h3>
            {[
              '系統嘗試自動擷取您的民宿頁面內容',
              'AI 解析民宿名稱、描述、設施、房型等資料',
              '您確認後一鍵匯入至民宿資料及房型管理',
              '匯入後可繼續補充照片、定價、通知信等細節',
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center shrink-0 text-[10px]">{i + 1}</span>
                {t}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
