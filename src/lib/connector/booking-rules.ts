// 讀後台連接器「解析規則」集中在伺服器端，外掛啟動時自動抓取並快取。
// 平台改版只要改這裡（bump version）重新部署，使用者端外掛免重載即自動更新。
// 規則皆為「字串化的正規表達式」，外掛用 new RegExp(str, 'i') 編譯。

export interface BookingParseRules {
  version: number
  // 依欄位名在訂單物件中尋值的正規式
  field: {
    id: string
    name: string
    room: string
    checkin: string
    checkout: string
    price: string
    guests: string
    status: string
  }
  cancel: string // 狀態字串判定為「已取消」
  idShape: string // 從原始單號萃取的形狀（如 A123456）
}

export const BOOKING_PARSE_RULES: BookingParseRules = {
  version: 5,
  field: {
    id: '(reservation|booking|confirmation|order)[_\\s]*(id|no|number|code)|^id$|reserveid|resid|bookingno|orderno|orderid',
    // 含 clientName（Trip/Ctrip 的訂房人欄位）
    name: 'guest.*name|customer.*name|booker|travel|contact.*name|^name$|guestname|contactname|client.*name|clientname',
    // 只抓「房型/房間名稱」欄位；用 (?!id) 避開 roomTypeId 等數字 ID，避免誤抓飯店名
    room: 'roomtypename|room.?type(?!id)|room_?name|roomname|roomenname|merchantroomname|bedroom.?type|unit.*(name|type)|rateplan.*room|房型|房間|房名',
    checkin: 'check.?in|arrival|arrivaldate|checkindate|start.*date|from.*date|indate',
    checkout: 'check.?out|depart|departure|checkoutdate|end.*date|to.*date|outdate',
    price: 'total.*(price|amount|rate|charge)|grand.*total|amount|price|revenue|payout|totalprice|orderamount',
    guests: 'guest.*(count|number|qty)|occupancy|adults|persons|pax|num.*guest|numguests|peoplecount',
    // 抓「文字版」狀態欄位（如 Trip orderStatusDesc「已取消」），避開數字版 orderStatus:100
    status: '^status$|statusdesc|statustype|orderstatustypestr|reservationstatus|bookingstatus|^state$|cancel|refund|void|取消|退订|退訂',
  },
  cancel: '取消|cancel|退订|退訂|refund|void',
  idShape: '[A-Za-z]?\\d{6,}',
}
