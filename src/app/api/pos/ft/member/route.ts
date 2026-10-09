import { NextResponse } from 'next/server'
import { isValidVnPhone, normalizeVnPhone } from '@/lib/ft-kiosk/cart'
import { FtError, checkMember, deviceKeyFrom, resolveDevice } from '@/lib/ft-kiosk/server'

/** 輸入電話查是否為會員（不需會員登入） */
export async function POST(req: Request) {
  const device = resolveDevice(deviceKeyFrom(req))
  if (!device) return NextResponse.json({ error: 'INVALID_DEVICE' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const phone = normalizeVnPhone(typeof body?.phone === 'string' ? body.phone : '')
  if (!isValidVnPhone(phone)) return NextResponse.json({ error: 'PHONE_INVALID' }, { status: 400 })
  try {
    return NextResponse.json({ phone, status: await checkMember(device, phone) })
  } catch (err) {
    const e = err instanceof FtError ? err : new FtError('UNKNOWN')
    return NextResponse.json({ error: e.code }, { status: e.status })
  }
}
