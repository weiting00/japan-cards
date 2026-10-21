# 測試

用 headless Chrome 跑的瀏覽器端測試，**不需要 npm、不需要建置**。

## 怎麼跑

```bash
./tests/run.sh              # 跑全部
./tests/run.sh dscontract   # 只跑指定測試
```

`run.sh` 會自己起一個本機靜態伺服器（預設 8899 起找空 port）、用 headless Chrome 開每個測試頁、
把頁面裡 `<pre id="AUDIT">` 的結果抓出來彙總，有失敗會以非 0 exit code 結束。

需求：Google Chrome（macOS 預設路徑）、python3。

## 測試一覽

| 檔案 | 測什麼 |
|---|---|
| `v3only.html` | `rulesV3` 為唯一真相，legacy 欄位不得回來 |
| `ed2.html` / `ed6.html` | 單卡編輯頁：欄位、加碼活動、刪除卡 |
| `activityedit.html` | 加碼活動可編輯，且編輯與新增的表單**完全一致** |
| `carded.html` | 卡片流程（新增 → 編輯 → 加碼 → 刪除） |
| `verify.html` | 規則計算與額度推導 |
| **`split.html`** | **拆刷契約**：依淨回饋率排序、加碼上限只決定可刷金額、同卡不同方案不去重 |
| `layout2.html` | 版面：寬度一致、標題靠左上 |
| `mobile.html` | 手機優先：底部按鈕／鍵盤不擋輸入框 |
| `migrate.html` | 舊版額度資料一次性遷移 |
| `struct2.html` | 資料結構完整性 |
| `final.html` | 綜合回歸 |
| **`dscontract.html`** | **元件契約**：token、跨頁面樣式一致性、字級階梯、結構規則 |

## 輔助工具（輸出量測結果，不是斷言測試）

| 檔案 | 用途 |
|---|---|
| `audit_ds.html` | 量測各元件的 computed style，列出不一致的項目 |
| `measure2.html` | 量測版面幾何（寬度、留白、位置） |
| `scrollcheck.html` | 驗證加碼活動表單的捲動位置 |
| `shot.html` | 產生各畫面的截圖（`shot.html#guide` / `#calc` / `#editor` / `#addcard`） |

> `shot.html` 的截圖可用 headless Chrome 產生：
> `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --virtual-time-budget=9000 --window-size=390,844 --screenshot=out.png "http://127.0.0.1:8766/tests/shot.html#editor"`

## 新增測試

1. 複製一個既有的測試檔改。
2. 測試頁用 `<iframe src="../index.html">` 載入 App（同一 origin，可直接 `contentWindow.eval` 取 `rulesV3`）。
3. 斷言寫成 `check('名稱', 條件, '實際值')`，最後把結果塞進 `<pre id="AUDIT">`。
4. 在 `run.sh` 的 `ALL=` 清單加上檔名。

> 提醒：`let` / `const` 的頂層宣告不會掛在 `window` 上，要用 `iframe.contentWindow.eval('rulesV3')` 取值。
> 刪除卡片／方案等流程是 async（等對話框回應），測試需等約 150–200ms 再按確認。
