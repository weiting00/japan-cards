# 第 2 段：規則計算核心純函式化

> 狀態：**已完成（Slice 2.1–2.6 全部落地）**
> 目的：在第 3 段換 React + shadcn/ui 之前，先把「商業計算」從 DOM／localStorage／可變全域狀態中切開。
> 這一段**不改畫面、不改使用流程**；只把計算搬進可獨立測試的純函式，UI 行為必須完全等價。

---

## 1. 為什麼要做這一段

目前 `index.html` 的計算函式（`evaluateV3Plan`、`calculate`、拆刷配置、額度結算）同時做三件事：

1. 讀取畫面狀態與 `rulesV3` 全域資料；
2. 計算回饋、門檻、額度、週期；
3. 直接修改 `part.periodKey` / `part.usedReward` / `v3PeriodResetOccurred` 等狀態。

這讓計算難以單獨測試，也讓第 3 段 React 化時必須連帶搬動副作用。第 2 段要把責任拆成：

```
UI / 事件
   ↓ 讀取輸入（金額、情境、店家、日期）
Adapter（index.html 內的薄層）
   ↓ 純資料
RuleEngine（engine.js：只回傳結果，不改輸入）
   ↓ 結果 + 狀態變更清單
Adapter
   ↓ 套用變更、寫 localStorage、重繪
UI
```

**單一真相來源**仍是 `rulesV3` 資料；純函式只是它的計算器。

---

## 2. 範圍

### 要做

- 週期 key、情境匹配、店家文字解析（已完成）。
- 單一方案的資格、回饋、門檻、上限計算。
- 多卡／多方案排序與最佳方案選擇。
- 拆刷配置（多段 allocation）。
- 額度週期重置判斷與剩餘額度。
- 把「玉山熊本熊／特定卡片」的硬編碼提示，改成由方案資料（`cycle`、`statementDay`、`contexts`、`sourceUrl` 等）驅動的通用提示。

### 不做（留給第 3 段）

- 不動視覺、版面、元件樣式。
- 不引入 React／shadcn／bundler。
- 不改 `rulesV3` 的資料格式（除非為了通用化且先補遷移）。
- 不改既有 localStorage key 與雲端 payload 格式。

---

## 3. 設計原則

1. **Pure core**：`engine.js` 不讀 DOM、不寫 localStorage、不修改傳入物件、不讀目前時間（日期由呼叫端傳入）。
2. **副作用留在邊界**：純函式回傳 `{ result, changes }`；由 `index.html` 套用 `changes`。
3. **Parity first**：每個 slice 都先補測試，再替換；替換時保留 legacy fallback，直到新路徑全綠。
4. **通用優先**：不得為單一卡片新增例外；若資料模型表達不了，先補模型與文件。
5. **一次一片**：每個 slice 獨立可回滾，不一次大改。

---

## 4. 已完成：Slice 2.1（純函式地基）

`engine.js` 已提供並由 `index.html` 委派：

| 函式 | 簽章 | 說明 |
|---|---|---|
| `getPeriodKey(plan, part, dateParts)` | `dateParts = {year, month, day}` | 月／季／活動／結帳日週期；短月份夾到月底；跨年正確。 |
| `planMatchesContexts(planContexts, selectedContexts, options)` | `options.merchantIncludesGeneral` | 情境 OR 匹配；保留「特約商店相容一般消費方案」舊行為。 |
| `parseMerchantText(text)` | `text: string` | 支援換行、逗號、頓號、分號；去重且保留順序。 |

`index.html` 的 `getV3PeriodKey`、`planMatchesSelection`、`parsePlanMerchantText` 已改為呼叫 `RuleEngine`；原本的 fallback 已在 Slice 2.6 移除。

測試：`tests/engine.html`（59 項）已納入 `tests/run.sh` 的 `ALL`。

---

## 5. 後續切片

### 已完成：Slice 2.2（單一方案評估純化）

`evaluateV3Plan(card, plan, spendTwd, merchant, evalContexts)` 的計算本體已搬到 `engine.js`。`index.html` 只保留 adapter：呼叫純函式、套用 `partChanges`、設定 `v3PeriodResetOccurred`。`evaluateV3PlanLegacy` 已在 Slice 2.6 移除；現在 `evaluateV3Plan` 只呼叫 `engine.js`。

純函式 API：

```js
RuleEngine.evaluatePlan({
  card, plan, spendTwd, merchant, contexts,
  today: '2026-11-09',
  dateParts: { year, month, day }
})
// → {
//   offer,               // 含 matchedParts / notes / capSpend / net ...
//   partChanges: [{ partId, periodKey, cumulativePeriodKey, cumulativeSpendTwd, usedReward }],
//   periodReset: boolean
// }
```

- 純函式用「傳入的 part 快照」計算，不改 `plan.rewardParts`。
- 已補 `tests/engine.html` 的評估測試（含週期重置、共用額度、累積門檻、特店名單、跨情境、活動期間、fallbackBase）。
- 全套測試維持全綠（483 項）。

### 已完成：Slice 2.3（排序與最佳方案純化）

`engine.js` 新增 `RuleEngine.rankOffers()`，把「情境匹配 → 特店預篩 → 單方案評估 → 基本回饋 fallback → 淨回饋排序 → 指定卡片偏好」搬成純函式。`index.html` 只保留 adapter：呼叫 `rankOffers()`、套用回傳的 `partChanges`、更新 `lastStoreOffers` 與顯示。

API：

```js
RuleEngine.rankOffers({
  cards, contexts, merchant, spendTwd, today, dateParts,
  preferredCardId, merchantIncludesGeneral
})
// → {
//   offers, storeOffers, storeBest,
//   preferredApplied, preferredCardId,
//   partChanges: [{ cardId, planId, change }],
//   periodReset
// }
```

- `storeOffers` 是套用指定卡片前的完整候選，`storeBest` 是店家最高回饋；`offers` 才是套用偏好後的排序。
- 特店方案全部未命中時，`rankOffers` 仍會用該卡基本回饋補位；PayPay-only 不補。
- 純函式不修改 `cards`／`plans`，跨週期重置只回傳 `partChanges`。
- legacy inline 排序已於 Slice 2.6 移除，`index.html` 只保留 `rankOffers()` adapter。
- 測試：`tests/engine.html` 新增 11 項（排序、偏好、特店命中／未命中、基本回饋 fallback、PayPay-only、純度與 partChanges）；全套 `653 passed, 0 failed`。

### 已完成：Slice 2.4（拆刷配置純化）

`engine.js` 新增 `RuleEngine.allocateSplit()`，把「淨回饋率排序 → 加碼段／基本回饋段 → quota group 合併 → 門檻檢查 → 金額分配 → 剩餘金額」搬成純函式。`index.html` 只保留 adapter：呼叫 `allocateSplit()`、用 `evaluateV3Plan` 重新試算每段、處理剩餘金額 fallback、比較拆刷與整筆刷。

API：

```js
RuleEngine.allocateSplit({ offers, spendTwd })
// → {
//   candidates: [...],              // 依淨回饋率排序的候選
//   allocations: [{ offer, amount }],
//   left                        // 尚未分配的金額，由 UI fallback 處理
// }
```

- 加碼段依「淨回饋率」排序；容量用完才輪到下一段，基本回饋段只拿基本回饋減手續費。
- 同一 `quotaGroupId` 只產生一個最高費率段，避免共用額度被重複分配。
- 剩餘金額未達門檻時跳過該加碼段；`left` 留給 UI 用基本回饋方案補位。
- `index.html` 只保留重新試算與 `left` fallback；legacy inline 拆刷已於 Slice 2.6 移除。
- 測試：`tests/engine.html` 新增 7 項（候選排序、加碼容量、基本回饋段、quota group、門檻、`left`）；`tests/split.html` 47 項全綠；全套 `660 passed, 0 failed`。

### 已完成：Slice 2.5（額度／週期狀態純化與通用提示）

`engine.js` 新增 `getQuotaState()`、`getCycleLabel()`、`getNextResetDate()`、`getNextResetLabel()`，把額度分組、已用／剩餘、週期標籤與下次重置日搬成純函式。`index.html` 的 `getV3QuotaEntries()` 改成薄 adapter，額度看板直接消費 `cycleLabel`／`nextResetLabel`／`remaining`。

- `getQuotaState({ cards, dateParts })` 會把同一 `quotaGroupId` 合併成一筆，`used` 加總並以 `cap` 夾住，`remaining = cap - used`。
- 月／季／帳單／活動／手動週期的下次重置日都在 `engine.js` 以純日曆計算，不建立 `Date`、不讀目前時間。
- 帳單結帳日提示改成通用資料驅動：只要有 `cycle === 'billing'` 且缺 `statementDay` 的方案就提示；儲存時套用到所有缺值的帳單週期方案，不再只找玉山熊本熊卡。
- 移除攻略頁未使用的 `getGuideKumaRate()` 單卡分支；決策頁百貨選項文案改成不綁定特定卡片。
- legacy 額度分組與週期字串已於 Slice 2.6 移除，`index.html` 只保留 `RuleEngine` adapter。
- 測試：`tests/engine.html` 新增 11 項（quotaGroup 合併、cap／used／remaining、月／季／帳單重置日、待確認結帳日、額度標籤）；全套 `671 passed, 0 failed`。

### 已完成：Slice 2.6（Parity Gate 與文件收尾）

`index.html` 已移除所有 legacy 計算路徑，只保留呼叫 `engine.js` 的 adapter 與 DOM 呈現：

- 移除 `evaluateV3PlanLegacy()` 與 `evaluateV3Plan()` 的 legacy fallback。
- 移除 `getV3PeriodKey()`、`getV3CycleLabel()`、`getV3NextResetLabel()`、`getV3QuotaEntries()` 的 inline fallback。
- 移除 `calculateRulesV3()` 內 legacy ranking 與 legacy split allocation fallback。
- 移除只為 legacy split 使用的 `offerNetRate()`、`offerThreshold()`、`splitCandidates`；保留 `offerKey()` 供剩餘金額補位。
- 移除店家原文解析與 `parsePlanMerchantText()` 的重複 fallback，統一由 `engine.js` 提供。
- legacy 實作刪除後，同步移除 `tests/engine.html` 中「與 legacy 本體 parity」的 5 項比較；其餘 89 項純函式契約仍全綠。
- 全套 `./tests/run.sh`：**666 passed, 0 failed**。
- `engine.js` 仍不含 `document`、`window.localStorage`、`fetch`、`new Date()`；日期由 UI 以 `Asia/Taipei` 取得後傳入。
- `DESIGN-SYSTEM.md`、`README.md`、`CARD_RULES_SPEC_3_1.md`、`tests/README.md` 已同步更新測試數與階段狀態。

第 2 段至此完成。下一段才開始第 3 段 React + shadcn/ui 遷移；本段沒有變更視覺主題或手機互動流程。

---

## 6. 驗收標準

1. `./tests/run.sh`：所有既有測試通過，新增 `engine` 測試通過。
2. 同樣輸入下，新舊計算結果一致（winner、每段金額、淨回饋、額度增減）。
3. `engine.js` 內不出現 `document`、`window.localStorage`、`fetch`、`new Date()`。
4. 不改畫面與互動；手機實機操作與現在相同。
5. 每個 slice 都可單獨回滾。

---

## 7. 風險與對策

| 風險 | 對策 |
|---|---|
| 計算结果與舊行為有細微差異 | 先補 parity／golden 測試；逐片替換，最後才移除 legacy fallback。 |
| 共用額度被重複扣除 | 純函式只回傳變更，由 adapter 統一提交；測試鎖住「只扣一次」。 |
| 日期／時區行為改變 | 日期一律由 adapter 以 `Asia/Taipei` 取得後傳入；純函式不讀時鐘。 |
| 卡片硬編碼轉通用時漏掉特例 | 先把特例寫成資料欄位或測試案例，再移除分支。 |

---

## 8. 下一步

第 2 段已完成，進入 **第 3 段：React + shadcn/ui 遷移**。

- 先把 `engine.js` 的純函式邊界固定下來，React 元件只消費計算結果與 `partChanges`。
- 依 `DESIGN-SYSTEM.md` 第 7 節，把 4 個頁面拆成 route，`switchTab()` 改為 `Tabs` + router。
- modal／editor 的 `hidden` 切換改為 `Dialog`／`Sheet` 的 `open` 狀態。
- 表單讀值改為 controlled state，避免直接讀 DOM。
- 視覺主題在該段才正式更換；目前 Cyber Neon 主題與手機互動流程維持不變。
- 每次遷移一個頁面或一組元件後，跑全套 `./tests/run.sh` 並做手機實機驗收。
