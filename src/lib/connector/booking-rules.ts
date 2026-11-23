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
  version: 3,
  field: {
    id: '(reservation|booking|confirmation|order)[_\\s]*(id|no|number|code)|^id$|reserveid|resid|bookingno|orderno|orderid',
    name: 'guest.*name|customer.*name|booker|travel|contact.*name|^name$|guestname|contactname',
    // 只抓「房型/房間」名稱，避免誤抓飯店/物業名稱（如 Agoda 的 Ciao Home）
    room: 'room.?type|roomtype|room_?name|roomname|bedroom.?type|unit.*(name|type)|rateplan.*room|房型|房間|房名',
    checkin: 'check.?in|arrival|arrivaldate|start.*date|from.*date|checkindate|date.*in|indate',
    checkout: 'check.?out|depart|departure|end.*date|to.*date|checkoutdate|date.*out|outdate',
    price: 'total.*(price|amount|rate|charge)|grand.*total|amount|price|revenue|payout|totalprice|orderamount',
    guests: 'guest.*(count|number|qty)|occupancy|adults|persons|pax|num.*guest|numguests|peoplecount',
    status: 'status|state|cancell|reservationstatus|orderstatus',
  },
  cancel: '取消|cancel|退订|退訂|refund|void',
  idShape: '[A-Za-z]?\\d{6,}',
}
