// 單一營業點公司：只有一個啟用中的營業點（fin_stores, unit_type=store）時回傳其代碼，否則 null。
// 這類公司不需要「門市」概念：員工自動歸屬到唯一營業點，介面隱藏門市選項。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

export async function singleSiteCode(db: Db, ownerId: string): Promise<string | null> {
  const { data } = await db.from('fin_stores').select('code, unit_type, active').eq('owner_id', ownerId)
  const list = ((data ?? []) as { code: string; unit_type: string | null; active: boolean | null }[])
    .filter(r => r.code && r.active !== false && (r.unit_type ?? 'store') === 'store')
  return list.length === 1 ? list[0].code : null
}

// 把沒有門市的員工歸屬到唯一營業點
export async function assignSingleSite(db: Db, ownerId: string): Promise<void> {
  const code = await singleSiteCode(db, ownerId)
  if (!code) return
  await db.from('hr_employees').update({ store: code }).eq('owner_id', ownerId).or('store.is.null,store.eq.')
}
