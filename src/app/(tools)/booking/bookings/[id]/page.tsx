'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit2, Printer, Save, X } from 'lucide-react'

interface Booking {
  id: string; platform: string; platform_booking_id: string
  guest_name: string; guest_email: string; guest_phone: string
  guest_gender: string; guest_birthday: string; guest_id_number: string; guest_address: string
  check_in: string; check_out: string; num_guests: number
  total_price: number | null; currency: string; status: string
  payment_type: string; arrival_time: string
  special_requests: string; notes: string; source: string
  created_at: string; updated_at: string
  properties: { id: string; name: string } | null
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  confirmed: { label: '已確認', color: 'bg-green-100 text-green-700' },
  pending:   { label: '待確認', color: 'bg-amber-100 text-amber-700' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-600' },
  completed: { label: '已完成', color: 'bg-gray-100 text-gray-600' },
  no_show:   { label: '未到訪', color: 'bg-orange-100 text-orange-700' },
}
const PLATFORM_NAMES: Record<string, string> = {
  booking_com: 'Booking.com', agoda: 'Agoda', airbnb: 'Airbnb',
  trip_com: 'Trip.com', asiayo: 'AsiaYo', easytravel: 'EasyTravel',
  manual: '手動', direct: '直訂',
}
const PAYMENT_LABELS: Record<string, string> = {
  channel: '通路收款', direct: '直接收款', unpaid: '未付款',
}

export default function BookingDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const [bk, setBk]       = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm]   = useState<Partial<Booking>>({})
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    fetch(`/api/booking/bookings/${id}`)
      .then(r => r.json())
      .then(d => { setBk(d.booking); setForm(d.booking ?? {}) })
      .finally(() => setLoading(false))
  }, [id])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/booking/bookings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...form }),
      })
      const d = await res.json()
      if (d.booking) { setBk(d.booking); setForm(d.booking); setEditing(false) }
    } finally { setSaving(false) }
  }

  function fi(label: string, key: keyof Booking, type: string = 'text') {
    const val = (form[key] ?? '') as string
    return (
      <div className="space-y-0.5">
        <div className="text-xs text-gray-400">{label}</div>
        {editing ? (
          <input type={type} value={val}
            onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
            className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        ) : (
          <div className="text-sm text-gray-900">{(bk as unknown as Record<string, unknown>)?.[key] as string || '—'}</div>
        )}
      </div>
    )
  }

  function nights() {
    if (!bk) return 0
    const ci = new Date(bk.check_in); const co = new Date(bk.check_out)
    return Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000))
  }

  if (loading) return <div className="p-8 text-center text-gray-400">載入中…</div>
  if (!bk) return <div className="p-8 text-center text-gray-400">找不到訂單</div>

  const st = STATUS_MAP[bk.status] ?? { label: bk.status, color: 'bg-gray-100 text-gray-600' }

  return (
    <div className="p-6 max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">訂單詳情</h1>
          <div className="text-xs text-gray-400">
            {bk.platform_booking_id ? `確認碼：${bk.platform_booking_id}` : `ID：${bk.id.slice(0, 8)}…`}
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <Printer className="h-4 w-4" /> 列印
        </button>
        {editing ? (
          <div className="flex gap-1.5">
            <button onClick={() => setEditing(false)}
              className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <X className="h-3.5 w-3.5" /> 取消
            </button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Edit2 className="h-4 w-4" /> 修改
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Order Info */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 pb-1 border-b">訂單資訊</h2>

          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">訂單來源</div>
            <div className="text-sm font-medium text-gray-900">{PLATFORM_NAMES[bk.platform] ?? bk.platform}</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">房型</div>
            <div className="text-sm text-gray-900">{bk.properties?.name ?? '—'}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-0.5">
              <div className="text-xs text-gray-400">入住</div>
              {editing ? (
                <input type="date" value={form.check_in ?? ''}
                  onChange={e => setForm(p => ({ ...p, check_in: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              ) : (
                <div className="text-sm text-gray-900">{bk.check_in}</div>
              )}
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-gray-400">退房</div>
              {editing ? (
                <input type="date" value={form.check_out ?? ''}
                  onChange={e => setForm(p => ({ ...p, check_out: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              ) : (
                <div className="text-sm text-gray-900">{bk.check_out} <span className="text-gray-400">({nights()} 晚)</span></div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-0.5">
              <div className="text-xs text-gray-400">入住人數</div>
              {editing ? (
                <input type="number" min={1} value={form.num_guests ?? 1}
                  onChange={e => setForm(p => ({ ...p, num_guests: parseInt(e.target.value) }))}
                  className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              ) : (
                <div className="text-sm text-gray-900">{bk.num_guests} 位</div>
              )}
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-gray-400">金額</div>
              {editing ? (
                <input type="number" value={form.total_price ?? ''}
                  onChange={e => setForm(p => ({ ...p, total_price: parseFloat(e.target.value) }))}
                  className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              ) : (
                <div className="text-sm text-gray-900">
                  {bk.total_price ? `${bk.currency} ${Number(bk.total_price).toLocaleString()}` : '—'}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">付款方式</div>
            {editing ? (
              <select value={form.payment_type ?? 'channel'}
                onChange={e => setForm(p => ({ ...p, payment_type: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            ) : (
              <div className="text-sm text-gray-900">{PAYMENT_LABELS[bk.payment_type] ?? '通路收款'}</div>
            )}
          </div>

          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">訂單狀態</div>
            {editing ? (
              <select value={form.status ?? 'confirmed'}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            ) : (
              <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
            )}
          </div>

          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">預訂時間</div>
            <div className="text-sm text-gray-900">{new Date(bk.created_at).toLocaleString('zh-TW')}</div>
          </div>
        </div>

        {/* Guest Info */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 pb-1 border-b">旅客資訊</h2>
          {fi('姓名', 'guest_name')}
          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">性別</div>
            {editing ? (
              <select value={(form.guest_gender ?? '') as string}
                onChange={e => setForm(p => ({ ...p, guest_gender: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">不填</option>
                <option value="male">男</option>
                <option value="female">女</option>
                <option value="other">其他</option>
              </select>
            ) : (
              <div className="text-sm text-gray-900">
                {{ male: '男', female: '女', other: '其他' }[bk.guest_gender] ?? '—'}
              </div>
            )}
          </div>
          {fi('電話', 'guest_phone', 'tel')}
          {fi('電子郵件', 'guest_email', 'email')}
          {fi('生日', 'guest_birthday', 'date')}
          {fi('身份證字號', 'guest_id_number')}
          {fi('地址', 'guest_address')}
          {fi('預計抵達時間', 'arrival_time')}
        </div>
      </div>

      {/* Notes & Requests */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 pb-1 border-b">備註與需求</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">旅客特殊需求</div>
            {editing ? (
              <textarea value={(form.special_requests ?? '') as string} rows={4}
                onChange={e => setForm(p => ({ ...p, special_requests: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            ) : (
              <div className="text-sm text-gray-900 whitespace-pre-wrap">{bk.special_requests || '—'}</div>
            )}
          </div>
          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">內部備註</div>
            {editing ? (
              <textarea value={(form.notes ?? '') as string} rows={4}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            ) : (
              <div className="text-sm text-gray-900 whitespace-pre-wrap">{bk.notes || '—'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
