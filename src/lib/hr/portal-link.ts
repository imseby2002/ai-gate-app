// 員工專區連結與通知訊息（client/server 共用，不含伺服器套件）
export function portalUrl(base: string | null | undefined, attendanceNo: string | null | undefined): string | null {
  const no = String(attendanceNo ?? '').trim()
  if (!base || !no) return null
  return `${base.replace(/\/$/, '')}/e/${encodeURIComponent(no)}`
}

// 中越雙語訊息：連結、用途與登入方式
export function portalMessage(name: string, url: string): string {
  return [
    `Xin chào ${name} / ${name} 您好`,
    `Trang nhân viên (phiếu lương, giờ có thể làm, lịch làm) / 員工專區（薪資條、可上班時段、班表）：`,
    url,
    `Lần đầu đăng nhập bằng ngày sinh DDMMYYYY (VD 15/08/1995 → 15081995) hoặc mật khẩu tạm do nhân sự cấp, sau đó đặt mật khẩu riêng.`,
    `第一次請用生日 DDMMYYYY（例 1995/08/15 → 15081995）或人事給的臨時密碼登入，登入後設定自己的密碼。`,
  ].join('\n')
}

// Zalo 以越南手機號開啟聊天（0 開頭轉 84）
export function zaloUrl(phone: string | null | undefined): string | null {
  const d = String(phone ?? '').replace(/\D/g, '')
  if (d.length < 9) return null
  return `https://zalo.me/${d.startsWith('0') ? '84' + d.slice(1) : d}`
}
