// 員工排班類型：人事資料「類別」為正職者選期待休假日；其餘（工讀）填可上班時段
export function isFulltime(emp: { staff_category?: string | null; employment_type?: string | null }): boolean {
  if (emp.staff_category) return emp.staff_category === 'fulltime'
  return emp.employment_type === 'full-time'
}

// PostgREST or() 篩選值加雙引號（門市代碼可能含空白，例：169 Quang Trung）
export function pgQuote(v: string): string {
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
