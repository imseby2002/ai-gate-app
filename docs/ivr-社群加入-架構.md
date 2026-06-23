# 電話行銷 IVR 按鍵加入社群 — 架構設計

## 定案方案

- **主力 CPaaS：Bird**（前 MessageBird）— 語音外撥/IVR/DTMF、SMS、WhatsApp、LINE 一站到底
- **ZALO 單獨接**：Zalo 官方 ZNS API（或 Infobip 純 API 模式），不另養月費平台
  - ZNS 一則約 300 VND，含 CTA 按鈕配置另計
- 理由：各家通路底價相同（Meta/Zalo/LINE 訂價），差別在月費；Bird PAYG 從 $0、無低消，ZALO 量不需專屬平台

## 整體流程

```
電話行銷外撥(Bird Voice) → 客戶接聽 → IVR 語音播報
  「加 LINE 按 1，加 WhatsApp 按 2，加 ZALO 按 3」
       ↓ 客戶按鍵 (DTMF)
Bird Voice webhook → /api/ivr/webhook/voice
       ↓ 記錄按鍵意願、產生短連結
依按鍵派送加入連結：
  - LINE/WhatsApp → Bird SMS 或對應通路推送短連結
  - ZALO → Zalo ZNS 範本訊息(含 CTA 導向 OA)
       ↓
客戶點擊短連結 → 加入 個人/群組/官方帳號
       ↓
平台 webhook 回報加入/follow → 綁定 contact、寫 joined_at
```

> 電話中無法直接點連結，**按鍵只負責表態，實際加入靠後送的訊息短連結**（三平台共通唯一可行路徑）。

## 各平台加入連結

| 平台 | 個人 | 群組 | 官方帳號 |
|------|------|------|----------|
| LINE | `https://line.me/ti/p/{userId}` | 群組邀請連結 | `https://line.me/R/ti/p/@{basicId}` |
| WhatsApp | `https://wa.me/{phone}?text=...` | `https://chat.whatsapp.com/{invite}` | `https://wa.me/{businessNumber}` |
| ZALO | `https://zalo.me/{oaId}` | 群組分享連結 | Zalo OA 連結（ZNS CTA 第1顆導 OA 免費） |

## 資料結構 (Supabase)

實作於 `supabase/migrations/052_ivr_social_join.sql`。沿用本專案慣例：每表 `user_id`(→profiles) + scope ACL，**非 tenant_id**。

| 表 | 類型 | 重點欄位 |
|----|------|----------|
| `ivr_campaigns` | 設定類 | user_id, name, voice_script, is_active |
| `ivr_key_mappings` | 設定類 | campaign_id, digit, channel, target_type, join_url；unique(campaign_id, digit) |
| `ivr_calls` | 營運類 | campaign_id, contact_id, phone, provider='bird', provider_call_id, status, pressed_digit |
| `ivr_join_events` | 營運類 | call_id, channel, delivery_method, short_token(unique), delivered_at, clicked_at, joined_at |

**RLS（新 scope = `'ivr'`）**
- 設定類：讀 `accessible_owner_ids('ivr')`、寫 `settings_owner_ids('ivr')`
- 營運類：僅 select 給 `accessible_owner_ids('ivr')`；寫入由 webhook/server 以 **service role** 進行
- 協作者授權靠 `bnb_members` 加 `scope='ivr'` 列（scope 函式為泛用，無需改 schema）

## API 端點

```
POST /api/ivr/campaigns          建立活動與按鍵對應
POST /api/ivr/calls/start        觸發 Bird 外撥
POST /api/ivr/webhook/voice      Bird Voice callback：通話狀態 + DTMF 按鍵
POST /api/ivr/webhook/message    Bird inbound：WhatsApp/LINE 加入事件
POST /api/ivr/webhook/zalo       Zalo ZNS / OA follow 事件
GET  /api/ivr/r/{token}          短連結：記 clicked_at 後 302 導向 join_url
```

## DTMF 收按鍵：兩種做法
- **Bird Flows（可視化）**：快，按鍵分支在後台拉
- **自接 webhook**：彈性高，邏輯在 /api/ivr/webhook/voice

建議先用 Bird Flows 跑通，複雜化後再轉自管。

## 轉換漏斗（可量測）
外撥數 → 接聽率 → 按鍵率(意願) → 短連結點擊率 → 實際加入率
各段落在上述四張表，後續可做活動成效報表。

## 實作進度
- [x] migration `052_ivr_social_join.sql`（4 表 + RLS scope=ivr）
- [x] `GET /api/ivr/r/[token]` 短連結轉址 + clicked_at
- [x] `POST /api/ivr/webhook/voice` Bird 通話狀態 + DTMF 派送
- [x] `POST /api/ivr/campaigns` GET/POST 活動與按鍵
- [x] `POST /api/ivr/calls/start` 觸發 Bird 外撥
- [x] `POST /api/ivr/webhook/zalo` ZNS 送達 / OA follow 回填
- [ ] 前端管理頁（活動設定、外撥名單、成效漏斗）
- [ ] LINE/WhatsApp 的 joined_at 回報（接既有 cs-webhook 或新 message webhook）

## 需要的環境變數
```
BIRD_API_KEY
BIRD_WORKSPACE_ID
BIRD_VOICE_CHANNEL_ID
BIRD_IVR_FLOW_ID          # 用 Bird Flow 做按鍵分支時
BIRD_SMS_CHANNEL_ID
ZALO_OA_ACCESS_TOKEN
ZALO_ZNS_TEMPLATE_ID
NEXT_PUBLIC_APP_URL       # 短連結 base（既有）
```

## 待辦 / 待確認
- [ ] Bird 後台確認：語音越南/台灣本地外顯號碼、WhatsApp 範本、LINE OA 綁定
- [ ] Zalo OA 開通 + ZNS 範本送審（含 CTA 配置）
- [ ] 短連結點擊追蹤自建（/api/ivr/r/{token}）
- [ ] 各通路加入/follow 事件 webhook 串接
- [ ] 行銷訊息 opt-out 退訂機制
