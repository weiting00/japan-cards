# 第 3 段：React + shadcn/ui 遷移

> 狀態：**進行中（Slice 3.1 外殼、Slice 3.2 共用資料層、Slice 3.3 決策頁已落地；待實機驗收）**
> 目的：把目前單檔 `index.html` 的 DOM／事件／畫面遷移到 React + shadcn/ui，同時保留 `engine.js` 作為唯一計算核心。
> 視覺主題在遷移期間**不重新設計**；先沿用目前 Cyber Neon Tokyo token，功能 parity 完成後才做視覺調整。

---

## 1. 邊界與原則

1. **計算核心不動**：React 只透過 `app/src/lib/engine.ts` 呼叫根目錄的 `engine.js`，不在元件內重寫規則。
2. **舊版是 parity gate**：Slice 3.8 切換入口前，根目錄 `index.html` 仍是正式入口，`./tests/run.sh` 必須全綠。
3. **一頁一頁搬**：每次只遷移一個頁面或一組流程，先補測試再切換。
4. **先功能、後視覺**：先沿用既有 class／token／間距，不趁遷移改主題。
5. **手機優先**：每個 slice 都要做 390×844 與實機驗收。
6. **資料層先穩定**：`rulesV3`、ledger、匯率、雲端同步先抽成模組與 hooks，畫面才不會各自讀 localStorage。

---

## 2. 目標結構

```text
app/
  src/
    main.tsx
    App.tsx
    routes/          decision / quotas / ledger / guide
    components/      shell、shared UI、shadcn primitives
    features/        decision / quotas / ledger / guide 的元件與 hooks
    lib/             engine bridge、storage、cloud sync、format、utils
    styles/          globals.css（token bridge）
    types/
  components.json    shadcn 設定
  vite.config.ts
```

路由使用 `HashRouter`，讓靜態主機不需要額外 rewrite；若之後改 BrowserRouter，再補 server fallback。

---

## 3. Slices

### 已完成：Slice 3.1（工具鏈與外殼）

- 建立 `app/`：Vite + React + TypeScript + Tailwind CSS v4。
- 加入 shadcn 設定（`components.json`）與 `cn()` 工具，Radix／lucide 依賴已安裝。
- 建立 4 個 route 外殼：`/decision`、`/quotas`、`/ledger`、`/guide`，預設導向決策頁。
- `app/src/lib/engine.ts` 直接匯入根目錄 `engine.js`，用 `window.RuleEngine` 取得純函式 API。
- `app/src/styles/globals.css` 建立 token bridge：沿用 `--a03`–`--a70`、Cyber Neon 主色、圓角與 shadow，並映射 shadcn 語意 token。
- 驗證：`npm run typecheck`、`npm run build` 通過；headless Chrome 可看到 route 外殼與「engine.js 已連線」。
- 根目錄 `index.html` 與既有測試完全未切換。

### 已完成：Slice 3.2（共用資料層）

- `app/src/lib/rules.ts`：內建 4 張卡／6 個方案的 `rulesV3` 種子、週期正規化、舊版 `context`／`parts`／`cap`／`used`／`merchant` 相容轉換；normalize 為純函式，不修改傳入物件。
- `app/src/lib/storage-keys.ts`、`storage.ts`：沿用 `index.html` 的 localStorage key 與資料格式，提供 rules／ledger／匯率／room 讀寫、舊版 ledger 一次性搬移、ledger 版本戳。
- `app/src/lib/app-data.ts`、`features/app-data/AppDataProvider.tsx`：以 React context 提供 `rulesV3`、ledger、匯率、room 與更新函式；更新時同步持久化，元件不直接讀寫 storage。
- `app/src/lib/date.ts`、`ledger.ts`：台北日期、記帳日期格式／舊格式解析、ledger 型別與正規化。
- 補 Vitest + jsdom 單元測試（29 項），涵蓋預設卡表、舊資料正規化、storage 搬移／版本戳、匯率、日期解析。
- 根目錄 `index.html` 與既有 666 項測試未切換；React 元件目前只多了資料層狀態顯示。

### 已完成：Slice 3.3（決策頁，待實機驗收）

- `app/src/routes/DecisionPage.tsx`：情境選擇、金額輸入／快捷加總、特店輸入、明細、拆刷模式、推薦結果、推薦原因、inline 特店原文、門檻補足提示、加入記帳。
- `app/src/features/decision/calculate.ts`：只透過 `engine.rankOffers()`、`engine.allocateSplit()`、`engine.evaluatePlan()` 計算；回傳 `partChanges`，render 期間不寫入規則。
- `app/src/features/decision/record.ts`：建立不可變 ledger 明細並更新加碼已用額度；拆刷會分攤日幣金額並建立多筆明細。
- 特店查詢保留搜尋-only modal、關鍵字命中數、特店原文 inline、指定卡片，以及「特店有命中但一般消費淨回饋更高」的比較說明。
- 補 Vitest + jsdom 測試（累計 42 項）：決策 winner、特店推薦、拆刷不低於單卡、門檻提示、ledger 建立／額度更新、React 互動與導頁。
- 驗證：`npm test`、`npm run typecheck`、`npm run build`、`npm run smoke` 通過；根目錄 `./tests/run.sh` 仍是 **666 passed, 0 failed**。
- 尚未完成：390×844 與 iOS／Android 實機驗收；Slice 3.8 前根目錄 `index.html` 仍是正式入口。

### 下一步：Slice 3.4 額度頁

- 額度分組、進度條、單筆／全部重置、週期與下次重置日、帳單結帳日提示。
- 直接消費 `engine.getQuotaState()`；不在 UI 重新分組或重算 remaining。

### Slice 3.5：記帳頁

- 明細列表、名稱／日期編輯、刪除、空白狀態、跨週期日期差值調整、雲端同步狀態。
- 表單改 controlled state；保留既有 localStorage／Supabase 契約。

### Slice 3.6：攻略頁

- 卡片／方案列表、加碼活動編輯、新增卡、新增方案、刪除卡／方案。
- 編輯器改用 shadcn `Dialog`／`Sheet`；表單欄位與目前 `index.html` 完全一致。
- 保留「一改就存」與存檔提示。

### Slice 3.7：共用層與手感

- 共用 Dialog／Sheet／Tabs／Button／Field 元件。
- Esc 逐層關閉、手機上一頁、focus trap、未儲存確認、存檔提示。
- 延續目前 `tests/ux.html` 的行為契約。

### Slice 3.8：切換入口與驗收

- 根目錄入口改為 React app（或 build 後輸出到根目錄）。
- 舊 `index.html` 移除或移到 `legacy/`；所有 legacy fallback 一併移除。
- 全套 parity：舊測試案例逐項搬到 React 測試或保留 DOM 契約測試。
- 390×844、實機 iOS／Android 驗收。
- 通過後才進行視覺主題調整。

---

## 4. 驗收標準

1. `app/npm test`、`app/npm run typecheck`、`app/npm run build` 全綠。
2. Slice 3.8 前，根目錄 `./tests/run.sh` 維持 **666 passed, 0 failed**。
3. 同一輸入下，React 與舊版 winner、拆刷段、淨回饋、額度增減一致。
4. `engine.js` 不出現 DOM／localStorage／fetch／`new Date()`。
5. 手機 390×844 與實機操作沒有多層返回、鍵盤遮擋或水平溢出。
6. 視覺 token 在切換前不得改變；切換後才允許主題調整。

---

## 5. 風險與對策

| 風險 | 對策 |
|---|---|
| 一次搬太多頁導致 parity 難追 | 一頁一頁搬，每頁先補同輸入測試 |
| React state 與 localStorage 不同步 | Slice 3.2 先抽資料層，元件不直接讀寫 storage |
| 表單 controlled state 改變編輯手感 | 先保留「一改就存」，用 shadcn 元件但不改流程 |
| 路由與靜態主機不相容 | 使用 `HashRouter`，必要時再補 server rewrite |
| 遷移期間兩套 UI 漂移 | 舊版仍是正式入口；React 只在新 route 開發，Slice 3.8 才切換 |
