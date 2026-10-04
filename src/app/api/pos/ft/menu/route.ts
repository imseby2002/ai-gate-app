import { NextResponse } from 'next/server'
import { FtError, deviceKeyFrom, fetchMenu, resolveDevice } from '@/lib/ft-kiosk/server'

/** 點單機（會員 APP 串接）取菜單 */
export async function GET(req: Request) {
  const device = resolveDevice(deviceKeyFrom(req))
  if (!device) return NextResponse.json({ error: 'INVALID_DEVICE' }, { status: 403 })
  try {
    return NextResponse.json(await fetchMenu(device))
  } catch (err) {
    const e = err instanceof FtError ? err : new FtError('UNKNOWN')
    return NextResponse.json({ error: e.code }, { status: e.status })
  }
}
