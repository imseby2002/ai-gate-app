import { NextResponse } from 'next/server'
import { isValidVnPhone, normalizeVnPhone } from '@/lib/ft-kiosk/cart'
import { FtError, deviceKeyFrom, placeOrder, resolveDevice } from '@/lib/ft-kiosk/server'
import type { FtOrderRequest, FtSelection } from '@/lib/ft-kiosk/types'

function parseSelections(v: unknown): FtSelection[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 30) return null
  const out: FtSelection[] = []
  for (const s of v) {
    if (!s || typeof s.itemId !== 'string' || !Array.isArray(s.optionIds)) return null
    out.push({
      itemId: s.itemId,
      childId: typeof s.childId === 'string' ? s.childId : null,
      optionIds: s.optionIds.filter((o: unknown): o is string => typeof o === 'string'),
      qty: Number(s.qty),
      note: typeof s.note === 'string' ? s.note : undefined,
    })
  }
  return out
}

/** 下單：一般模式經會員 APP 後端送 iPOS（CASH → COD）；列印模式只存本地訂單並回傳單據 */
export async function POST(req: Request) {
  const deviceKey = deviceKeyFrom(req)
  const device = resolveDevice(deviceKey)
  if (!device || !deviceKey) return NextResponse.json({ error: 'INVALID_DEVICE' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const selections = parseSelections(body?.selections)
  if (!selections) return NextResponse.json({ error: 'CART_INVALID' }, { status: 400 })

  let phone: string | null = null
  if (typeof body?.phone === 'string' && body.phone) {
    phone = normalizeVnPhone(body.phone)
    if (!isValidVnPhone(phone)) return NextResponse.json({ error: 'PHONE_INVALID' }, { status: 400 })
  }

  const request: FtOrderRequest = {
    selections,
    phone,
    dineOption: body?.dineOption === 'takeaway' ? 'takeaway' : 'dine_in',
  }
  try {
    return NextResponse.json(await placeOrder(device, request, deviceKey))
  } catch (err) {
    const e = err instanceof FtError ? err : new FtError('UNKNOWN')
    return NextResponse.json({ error: e.code }, { status: e.status })
  }
}
