'use client'
import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit2, Printer, Save, X, Trash2 } from 'lucide-react'

interface Booking {
  id: string; order_id: string | null; platform: string; platform_booking_id: string
  guest_name: string; guest_email: string; guest_phone: string
  guest_gender: string; guest_birthday: string; guest_id_number: string; guest_address: string
  check_in: string; check_out: string; num_guests: number
  total_price: number | null; currency: string; status: string
  payment_type: string; arrival_time: string
  deposit_amount: number | null; is_paid: boolean
  special_requests: string; notes: string; source: string
  created_at: string; updated_at: string
  properties: { id: string; name: string } | null
}

interface OrderInfo {
  id: string; platform: string; platform_booking_id: string
  guest_name: string; guest_email: string; guest_phone: string
  guest_gender: string; guest_birthday: string; guest_id_number: string; guest_address: string
  payment_type: string; arrival_time: string
  deposit_amount: number | null; is_paid: boolean
  special_requests: string; notes: string
  created_at: string
}

interface RoomRow {
  id: string; property_id: string | null
  check_in: string; check_out: string; num_guests: number
  total_price: number | null; currency: string; status: string
  properties: { id: string; name: string } | null
}

const ORDER_EDIT_FIELDS: (keyof OrderInfo)[] = [
  'guest_name', 'guest_email', 'guest_phone', 'guest_gender', 'guest_birthday',
  'guest_id_number', 'guest_address', 'payment_type', 'arrival_time',
  'deposit_amount', 'is_paid', 'special_requests', 'notes', 'platform_booking_id', 'platform',
]

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending:   'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-600',
  completed: 'bg-gray-100 text-gray-600',
  no_show:   'bg-orange-100 text-orange-700',
}

export default function BookingDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const t         = useTranslations('Booking')
  const locale    = useLocale()
  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    confirmed: { label: t('status.confirmed'), color: STATUS_COLORS.confirmed },
    pending:   { label: t('status.pending'),   color: STATUS_COLORS.pending },
    cancelled: { label: t('status.cancelled'), color: STATUS_COLORS.cancelled },
    completed: { label: t('status.completed'), color: STATUS_COLORS.completed },
    no_show:   { label: t('status.no_show'),   color: STATUS_COLORS.no_show },
  }
  const PLATFORM_NAMES: Record<string, string> = {
    booking_com: 'Booking.com', agoda: 'Agoda', airbnb: 'Airbnb',
    trip_com: 'Trip.com', asiayo: 'AsiaYo', easytravel: 'EasyTravel',
    manual: t('platform.manual'), direct: t('platform.direct'),
  }
  const PAYMENT_LABELS: Record<string, string> = {
    channel: t('payment.channel'), direct: t('payment.direct'), unpaid: t('payment.unpaid'),
  }

  const [bk, setBk]           = useState<Booking | null>(null)
  const [order, setOrder]     = useState<OrderInfo | null>(null)
  const [rooms, setRooms]     = useState<RoomRow[]>([])
  const [loading, setLoading] = useState(true)

  const [editingOrder, setEditingOrder] = useState(false)
  const [orderForm, setOrderForm]       = useState<Partial<OrderInfo>>({})
  const [savingOrder, setSavingOrder]   = useState(false)
  const [deletingOrder, setDeletingOrder] = useState(false)

  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [roomForm, setRoomForm]           = useState<Partial<RoomRow>>({})
  const [roomSaving, setRoomSaving]       = useState(false)
  const [roomDeletingId, setRoomDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/booking/bookings/${id}`)
      .then(r => r.json())
      .then(d => {
        setBk(d.booking)
        setOrder(d.order ?? null)
        setOrderForm(d.order ?? {})
        // 沒有訂單資料（極少數還沒補齊的舊資料）時，至少把目前這間房顯示出來
        setRooms(d.order ? (d.rooms ?? []) : (d.booking ? [{
          id: d.booking.id, property_id: d.booking.properties?.id ?? null,
          check_in: d.booking.check_in, check_out: d.booking.check_out, num_guests: d.booking.num_guests,
          total_price: d.booking.total_price, currency: d.booking.currency, status: d.booking.status,
          properties: d.booking.properties,
        }] : []))
      })
      .finally(() => setLoading(false))
  }, [id])

  async function saveOrder() {
    if (!order) return
    setSavingOrder(true)
    try {
      const patch: Record<string, unknown> = {}
      for (const key of ORDER_EDIT_FIELDS) patch[key] = (orderForm as Record<string, unknown>)[key] ?? null
      // 訂單號碼是「沒有單號」跟其他訂單共用 null 的唯一鍵（見 migration 096），
      // 清空欄位要存成 null，不能存空字串，不然兩張都清空的訂單會互相撞到唯一鍵。
      if (patch.platform_booking_id === '') patch.platform_booking_id = null
      const res = await fetch(`/api/booking/orders/${order.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const d = await res.json()
      if (!res.ok) { window.alert(d.error ?? '儲存失敗'); return }
      if (d.order) { setOrder(d.order); setOrderForm(d.order); setEditingOrder(false) }
      if (d.warning) window.alert(d.warning)
    } finally { setSavingOrder(false) }
  }

  async function removeOrder() {
    if (!order) return
    if (!window.confirm(t('detail.deleteOrderConfirm'))) return
    setDeletingOrder(true)
    try {
      const res = await fetch(`/api/booking/orders/${order.id}`, { method: 'DELETE' })
      if (!res.ok) { setDeletingOrder(false); return }
      router.back()
    } catch { setDeletingOrder(false) }
  }

  function startEditRoom(room: RoomRow) {
    setEditingRoomId(room.id)
    setRoomForm(room)
  }

  async function saveRoom() {
    if (!editingRoomId) return
    setRoomSaving(true)
    try {
      const res = await fetch('/api/booking/bookings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRoomId,
          check_in: roomForm.check_in, check_out: roomForm.check_out,
          num_guests: roomForm.num_guests, total_price: roomForm.total_price,
          status: roomForm.status,
        }),
      })
      const d = await res.json()
      if (d.booking) {
        setRooms(rs => rs.map(r => r.id === editingRoomId ? { ...r, ...d.booking } : r))
        if (bk && bk.id === editingRoomId) setBk({ ...bk, ...d.booking })
        setEditingRoomId(null)
      }
    } finally { setRoomSaving(false) }
  }

  async function removeRoom(roomId: string) {
    if (!window.confirm(t('detail.roomDeleteConfirm'))) return
    setRoomDeletingId(roomId)
    try {
      const res = await fetch('/api/booking/bookings', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: roomId }),
      })
      if (!res.ok) { setRoomDeletingId(null); return }
      // 刪的剛好是這一頁進來時的那間房，這間已經不在了，回到上一頁
      if (roomId === id) { router.back(); return }
      setRooms(rs => rs.filter(r => r.id !== roomId))
    } finally { setRoomDeletingId(null) }
  }

  function ofi(label: string, key: keyof OrderInfo, type: string = 'text') {
    const val = (orderForm[key] ?? '') as string
    return (
      <div className="space-y-0.5">
        <div className="text-xs text-gray-400">{label}</div>
        {editingOrder ? (
          <input type={type} value={val}
            onChange={e => setOrderForm(p => ({ ...p, [key]: e.target.value }))}
            className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        ) : (
          <div className="text-sm text-gray-900">{(order as unknown as Record<string, unknown>)?.[key] as string || '—'}</div>
        )}
      </div>
    )
  }

  function nightsOf(room: Pick<RoomRow, 'check_in' | 'check_out'>) {
    const ci = new Date(room.check_in); const co = new Date(room.check_out)
    return Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000))
  }

  if (loading) return <div className="p-8 text-center text-gray-400">{t('common.loading')}</div>
  if (!bk) return <div className="p-8 text-center text-gray-400">{t('detail.notFound')}</div>

  return (
    <div className="p-6 pb-16 max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">{t('detail.title')}</h1>
          <div className="text-xs text-gray-400">
            {(order?.platform_booking_id ?? bk.platform_booking_id)
              ? t('detail.confirmCode', { code: (order?.platform_booking_id ?? bk.platform_booking_id) })
              : t('detail.idLabel', { id: bk.id.slice(0, 8) })}
          </div>
        </div>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <Printer className="h-4 w-4" /> {t('detail.print')}
        </button>
        {order && (
          <button onClick={removeOrder} disabled={deletingOrder} title={t('detail.deleteOrder')}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-rose-500 hover:bg-rose-50 disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> {t('detail.deleteOrder')}
          </button>
        )}
        {order && (editingOrder ? (
          <div className="flex gap-1.5">
            <button onClick={() => { setEditingOrder(false); setOrderForm(order) }}
              className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <X className="h-3.5 w-3.5" /> {t('bookings.form.cancel')}
            </button>
            <button onClick={saveOrder} disabled={savingOrder}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> {savingOrder ? t('bookings.form.saving') : t('detail.save')}
            </button>
          </div>
        ) : (
          <button onClick={() => setEditingOrder(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Edit2 className="h-4 w-4" /> {t('detail.edit')}
          </button>
        ))}
      </div>

      {!order && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
          {t('detail.noOrderData')}
        </div>
      )}

      {/* 房型明細：同一張訂單底下全部房型，用真正的 order_id 外鍵抓出來（見 migration 096），
          可以在這裡整單一起看、個別編輯或刪除，不用再猜同單號有沒有別間房。 */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-800 pb-1 border-b">{t('detail.roomsSection')}</h2>
        <div className="space-y-2">
          {rooms.map(room => {
            const rst = STATUS_MAP[room.status] ?? { label: room.status, color: 'bg-gray-100 text-gray-600' }
            const isCurrent = room.id === id
            const isEditingRoom = editingRoomId === room.id
            return (
              <div key={room.id}
                className={`rounded-lg border p-3 ${isCurrent ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-200'}`}>
                {isEditingRoom ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={roomForm.check_in ?? ''}
                        onChange={e => setRoomForm(p => ({ ...p, check_in: e.target.value }))}
                        className="text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      <input type="date" value={roomForm.check_out ?? ''}
                        onChange={e => setRoomForm(p => ({ ...p, check_out: e.target.value }))}
                        className="text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" min={1} value={roomForm.num_guests ?? 1}
                        onChange={e => setRoomForm(p => ({ ...p, num_guests: parseInt(e.target.value) }))}
                        className="text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      <input type="number" value={roomForm.total_price ?? ''}
                        onChange={e => setRoomForm(p => ({ ...p, total_price: parseFloat(e.target.value) }))}
                        className="text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      <select value={roomForm.status ?? 'confirmed'}
                        onChange={e => setRoomForm(p => ({ ...p, status: e.target.value }))}
                        className="text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                        {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => setEditingRoomId(null)}
                        className="flex items-center gap-1 px-2.5 py-1 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                        <X className="h-3 w-3" /> {t('bookings.form.cancel')}
                      </button>
                      <button onClick={saveRoom} disabled={roomSaving}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-50">
                        <Save className="h-3 w-3" /> {roomSaving ? t('bookings.form.saving') : t('detail.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{room.properties?.name ?? '—'}</div>
                      <div className="text-xs text-gray-500">
                        {room.check_in} → {room.check_out} ({t('detail.nights', { nights: nightsOf(room) })}) · {t('detail.guestsUnit', { count: room.num_guests })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {room.total_price != null && (
                        <span className="text-sm text-gray-700">{room.currency} {Number(room.total_price).toLocaleString()}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rst.color}`}>{rst.label}</span>
                      <button onClick={() => startEditRoom(room)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => removeRoom(room.id)} disabled={roomDeletingId === room.id}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Order Info */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 pb-1 border-b">{t('detail.orderInfo')}</h2>

          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">{t('detail.source')}</div>
            {editingOrder ? (
              <select value={orderForm.platform ?? 'manual'}
                onChange={e => setOrderForm(p => ({ ...p, platform: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {Object.entries(PLATFORM_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            ) : (
              <div className="text-sm font-medium text-gray-900">{PLATFORM_NAMES[order?.platform ?? bk.platform] ?? (order?.platform ?? bk.platform)}</div>
            )}
          </div>

          {ofi(t('detail.confirmCodeLabel'), 'platform_booking_id')}

          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">{t('detail.paymentMethod')}</div>
            {editingOrder ? (
              <select value={orderForm.payment_type ?? 'channel'}
                onChange={e => setOrderForm(p => ({ ...p, payment_type: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            ) : (
              <div className="text-sm text-gray-900">{PAYMENT_LABELS[order?.payment_type ?? ''] ?? t('payment.channel')}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-0.5">
              <div className="text-xs text-gray-400">{t('detail.deposit')}</div>
              {editingOrder ? (
                <input type="number" value={orderForm.deposit_amount ?? ''}
                  onChange={e => setOrderForm(p => ({ ...p, deposit_amount: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                  className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              ) : (
                <div className="text-sm text-gray-900">
                  {order?.deposit_amount != null ? `${bk.currency} ${Number(order.deposit_amount).toLocaleString()}` : '—'}
                </div>
              )}
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-gray-400">{t('detail.isPaid')}</div>
              {editingOrder ? (
                <label className="flex items-center gap-2 text-sm text-gray-700 h-[34px]">
                  <input type="checkbox" checked={!!orderForm.is_paid}
                    onChange={e => setOrderForm(p => ({ ...p, is_paid: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-300" />
                  {t('detail.isPaid')}
                </label>
              ) : (
                <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${order?.is_paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {order?.is_paid ? t('detail.paidYes') : t('detail.paidNo')}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">{t('detail.bookedAt')}</div>
            <div className="text-sm text-gray-900">{new Date((order?.created_at ?? bk.created_at)).toLocaleString(locale)}</div>
          </div>
        </div>

        {/* Guest Info */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 pb-1 border-b">{t('detail.guestInfo')}</h2>
          {ofi(t('detail.name'), 'guest_name')}
          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">{t('detail.gender')}</div>
            {editingOrder ? (
              <select value={(orderForm.guest_gender ?? '') as string}
                onChange={e => setOrderForm(p => ({ ...p, guest_gender: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">{t('detail.genderNone')}</option>
                <option value="male">{t('gender.male')}</option>
                <option value="female">{t('gender.female')}</option>
                <option value="other">{t('gender.other')}</option>
              </select>
            ) : (
              <div className="text-sm text-gray-900">
                {{ male: t('gender.male'), female: t('gender.female'), other: t('gender.other') }[order?.guest_gender ?? ''] ?? '—'}
              </div>
            )}
          </div>
          {ofi(t('detail.phone'), 'guest_phone', 'tel')}
          {ofi(t('detail.email'), 'guest_email', 'email')}
          {ofi(t('detail.birthday'), 'guest_birthday', 'date')}
          {ofi(t('detail.idNumber'), 'guest_id_number')}
          {ofi(t('detail.address'), 'guest_address')}
          {ofi(t('detail.arrivalTime'), 'arrival_time')}
        </div>
      </div>

      {/* Notes & Requests */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 pb-1 border-b">{t('detail.notesSection')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">{t('detail.specialRequests')}</div>
            {editingOrder ? (
              <textarea value={(orderForm.special_requests ?? '') as string} rows={4}
                onChange={e => setOrderForm(p => ({ ...p, special_requests: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            ) : (
              <div className="text-sm text-gray-900 whitespace-pre-wrap">{order?.special_requests || '—'}</div>
            )}
          </div>
          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">{t('detail.internalNotes')}</div>
            {editingOrder ? (
              <textarea value={(orderForm.notes ?? '') as string} rows={4}
                onChange={e => setOrderForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            ) : (
              <div className="text-sm text-gray-900 whitespace-pre-wrap">{order?.notes || '—'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
