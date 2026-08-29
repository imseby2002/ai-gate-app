## 回應風格

* 簡潔直接，不解釋原因
* 直接給答案或處理結果
* 不加前言、不加總結

## 工作原則
- 每次只讀取必要的檔案，不要一次讀取整個專案
- 修改前先確認檔案路徑，不要猜測
- 大型重構分多個小步驟執行

## 禁止行為
- 禁止啟動 dev server
- 禁止執行 find / rg / grep 掃描整個專案

> 例外：`worker/` 目錄為獨立自動化 worker（在另一台 VM 執行，非本 app 部署），允許使用 Playwright/瀏覽器自動化並於該目錄內安裝套件。此例外僅限 `worker/`，主 app（`src/`）仍不得引入瀏覽器自動化或新套件。

## 模型設定
- 優先使用最新的 Claude 模型（claude-sonnet-4-6、claude-opus-4-8）

## Auth 參考

**Clients**
- `src/lib/supabase/server.ts` → `createClient()`
- `src/lib/supabase/admin.ts` → `createAdminClient()`

**取得用戶與權限**
```ts
const { data: { user } } = await supabase.auth.getUser()
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single()
```

**用戶類型**：`profile.user_type` → `'admin' | 'employee' | 'external'`

**HTTP 狀態碼**
- 未登入 → 401
- 餘額不足 → 402
- 停用 → 403

**路由判斷**
- Admin：`profile.user_type === 'admin'` → `/admin`
- 其他：`/dashboard`

## Git 工作流

**每次開始工作前**執行：
```
git pull --rebase
```
若出現 merge conflict，告知我再繼續。

**每次修改完畢後**自動執行（不需詢問）：
1. git add -A
2. git commit -m "描述本次修改內容"
3. git push
   - 若被拒，自動執行 git pull --rebase 再 push
   - 除非有 merge conflict 需手動解決，才告知我
