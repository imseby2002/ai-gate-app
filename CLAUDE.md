## 回應風格

* 簡潔直接，不解釋原因
* 直接給答案或處理結果
* 不加前言、不加總結

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

## 核心架構參考
詳見 [README.md](./README.md) 或相關源代碼註解。
