import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  const searchKey = req.nextUrl.searchParams.get('key') ?? ''

  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const { data: src } = await supabase
    .from('cs_data_sources')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!src) return NextResponse.json({ error: '找不到此資料來源' }, { status: 404 })

  const cfg = src.config as {
    apiKey: string; spreadsheetId: string; sheetName: string; keyColumn: string
  }

  const range = encodeURIComponent(`${cfg.sheetName}!A:Z`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cfg.spreadsheetId}/values/${range}?key=${cfg.apiKey}`

  let rawBody = ''
  let status = 0
  try {
    const res = await fetch(url)
    status = res.status
    rawBody = await res.text()
  } catch (e) {
    return NextResponse.json({ error: `fetch 失敗：${String(e)}` }, { status: 500 })
  }

  if (status !== 200) {
    return NextResponse.json({ httpStatus: status, error: rawBody.slice(0, 500) }, { status: 200 })
  }

  const json = JSON.parse(rawBody)
  const rows: string[][] = json.values ?? []
  const headers: string[] = rows[0] ?? []
  const dataRows = rows.slice(1)

  const cellStr = (v: unknown) => String(v ?? '').replace(/,/g, '').trim()

  const keyColIdx = headers.findIndex(h => h.trim() === cfg.keyColumn.trim())

  const keyColumnSample = dataRows.slice(0, 10).map(row => ({
    raw: row[keyColIdx] ?? '(空)',
    normalized: cellStr(row[keyColIdx]),
    match: searchKey ? cellStr(row[keyColIdx]) === searchKey.trim() : null,
  }))

  const matchedRow = searchKey
    ? dataRows.find(row => headers.some((_, i) => cellStr(row[i]) === searchKey.trim()))
    : null

  return NextResponse.json({
    httpStatus: status,
    sheetName: cfg.sheetName,
    headers,
    keyColumn: cfg.keyColumn,
    keyColIdx,
    totalRows: dataRows.length,
    keyColumnSample,
    searchKey,
    matchedRow: matchedRow ?? null,
  })
}
