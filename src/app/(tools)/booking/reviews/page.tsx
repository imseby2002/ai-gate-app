'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Star, Trash2, MessageSquare, Loader2 } from 'lucide-react'

interface Review {
  id: string; user_id: string; booking_id: string | null; property_id: string | null
  platform: string; guest_name: string; rating: number | null; title: string | null
  comment: string | null; reply: string | null; replied_at: string | null
  review_date: string | null; created_at: string
  properties?: { name: string } | null
}

const PLATFORM_LABELS: Record<string, string> = {
  booking_com: 'Booking.com', agoda: 'Agoda', airbnb: 'Airbnb',
  google: 'Google', trip_com: 'Trip.com', asiayo: 'AsiaYo',
  tripadvisor: 'TripAdvisor', manual: '手動新增',
}
const PLATFORMS = Object.entries(PLATFORM_LABELS)

function StarRating({ rating, max = 10 }: { rating: number | null; max?: number }) {
  if (rating === null) return <span className="text-gray-300 text-xs">—</span>
  const pct = rating / max
  const color = pct >= 0.8 ? 'text-emerald-500' : pct >= 0.6 ? 'text-amber-500' : 'text-rose-500'
  return (
    <span className={`font-bold text-sm ${color}`}>
      {rating % 1 === 0 ? rating.toFixed(0) : rating.toFixed(1)}
      <span className="text-gray-400 font-normal text-xs">/{max}</span>
    </span>
  )
}

function fmtDate(s: string | null) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function ReviewsPage() {
  const [reviews, setReviews]   = useState<Review[]>([])
  const [loading, setLoading]   = useState(true)
  const [replyModal, setReplyModal] = useState(false)
  const [selected, setSelected] = useState<Review | null>(null)
  const [replyText, setReplyText] = useState('')
  const [saving, setSaving]     = useState(false)
  const [filterPlatform, setFilterPlatform] = useState('')

  useEffect(() => {
    fetch('/api/booking/reviews').then(r => r.json())
      .then(d => setReviews(d.reviews ?? []))
      .finally(() => setLoading(false))
  }, [])

  function openReply(r: Review) {
    setReplyText(r.reply ?? '')
    setSelected(r)
    setReplyModal(true)
  }

  async function saveReply() {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch('/api/booking/reviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, reply: replyText }),
      })
      const d = await res.json()
      if (d.review) setReviews(prev => prev.map(r => r.id === selected.id ? d.review : r))
      setReplyModal(false)
    } finally { setSaving(false) }
  }

  async function deleteReview(id: string) {
    if (!confirm('確定要刪除這則評價？')) return
    await fetch('/api/booking/reviews', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setReviews(prev => prev.filter(r => r.id !== id))
  }

  const filtered = filterPlatform ? reviews.filter(r => r.platform === filterPlatform) : reviews
  const avgRating = reviews.filter(r => r.rating !== null).length > 0
    ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.filter(r => r.rating !== null).length).toFixed(1)
    : null
  const replyRate = reviews.length > 0
    ? Math.round(reviews.filter(r => r.reply).length / reviews.length * 100)
    : 0

  return (
    <div className="p-4 md:p-6 pb-16 max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">評價管理</h1>
        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
          <span>共 {reviews.length} 則評價</span>
          {avgRating && <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-400 fill-amber-400" /> 平均 {avgRating} 分</span>}
          <span>回覆率 {replyRate}%</span>
        </div>
      </div>

      {/* Platform filter */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilterPlatform('')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!filterPlatform ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          全部
        </button>
        {PLATFORMS.filter(([p]) => reviews.some(r => r.platform === p)).map(([p, l]) => (
          <button key={p} onClick={() => setFilterPlatform(p)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterPlatform === p ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">載入中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          <Star className="h-10 w-10 mx-auto mb-3 text-gray-200" />
          尚無評價
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-xl border p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{r.guest_name || '匿名旅客'}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {PLATFORM_LABELS[r.platform] ?? r.platform}
                  </span>
                  {r.properties?.name && (
                    <span className="text-xs text-gray-400">· {r.properties.name}</span>
                  )}
                  {r.review_date && <span className="text-xs text-gray-400">{fmtDate(r.review_date)}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <StarRating rating={r.rating} />
                </div>
              </div>

              {r.title && <p className="text-sm font-medium text-gray-800">{r.title}</p>}
              {r.comment && <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>}

              {r.reply && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-800 space-y-0.5">
                  <div className="font-semibold text-indigo-600 text-[10px] uppercase tracking-wide">民宿回覆</div>
                  <p className="leading-relaxed">{r.reply}</p>
                </div>
              )}

              <div className="flex items-center gap-1.5 pt-0.5">
                <button onClick={() => openReply(r)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                  <MessageSquare className="h-3 w-3" /> {r.reply ? '編輯回覆' : '回覆'}
                </button>
                <button onClick={() => deleteReview(r.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border text-rose-500 border-rose-200 hover:bg-rose-50 ml-auto">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply Modal */}
      {replyModal && selected && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setReplyModal(false) }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92dvh] flex flex-col">
            <div className="px-5 pt-5 pb-3 shrink-0 border-b">
              <h3 className="font-bold text-gray-900">回覆旅客評價</h3>
              <p className="text-xs text-gray-500 mt-0.5">{selected.guest_name || '匿名旅客'} · {fmtDate(selected.review_date)}</p>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {selected.comment && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 leading-relaxed border-l-2 border-gray-200">
                  {selected.comment}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">您的回覆</label>
                <textarea value={replyText} rows={5}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="感謝您的評價…"
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
            <div className="shrink-0 flex gap-2 px-5 py-4 border-t">
              <button onClick={() => setReplyModal(false)}
                className="flex-1 py-2 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={saveReply} disabled={saving}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                {saving ? '儲存中…' : '送出回覆'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
