# 第 2 段：規則計算核心純函式化

> 狀態：**進行中（Slice 2.1、2.2 已落地）**
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

`index.html` 的 `getV3PeriodKey`、`planMatchesSelection`、`parsePlanMerchantText` 已改為優先呼叫 `RuleEngine`，並保留原本實作作為 fallback（`engine.js` 載入失敗時仍可運作）。

測試：`tests/engine.html`（59 項）已納入 `tests/run.sh` 的 `ALL`。

---

## 5. 後續切片

### 已完成：Slice 2.2（單一方案評估純化）

`evaluateV3Plan(card, plan, spendTwd, merchant, evalContexts)` 的計算本體已搬到 `engine.js`。`index.html` 只保留 adapter：呼叫純函式、套用 `partChanges`、設定 `v3PeriodResetOccurred`。`evaluateV3PlanLegacy` 暫時保留作為 `engine.js` 載入失敗時的 fallback，待 Slice 2.6 移除。

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

### Slice 2.3：排序與最佳方案純化

- 抽出 `rankOffers({ cards, inputs, contexts, merchant, spendTwd })`。
- 移除 `calculate()` 內的排序細節；UI 只負責取結果與顯示。
- 測試：交通／一般消費／特約商店的 winner 與排序穩定。

### Slice 2.4：拆刷配置純化

- 抽出 `allocateSplit({ offers, spendTwd, maxSegments })`，回傳 allocations。
- 與現有 `split.html` 的 25 項斷言逐項對照。
- 保持「同一方案只扣一次共用額度」的語意。

### Slice 2.5：額度／週期狀態純化與通用提示

- 抽出 `getQuotaState({ cards, dateParts })`：已用、剩餘、上限、下次重置日。
- 將目前卡片專屬提示（結帳日、熊本熊字樣、特定警告）改成資料驅動：
  - 結帳日提示只看 `cycle === 'billing' && !statementDay`。
  - 攻略頁摘要只看 `contexts` 與方案資料，不出現卡片名稱硬編碼。
- 移除殘留的單卡分支（若資料模型可表達）。

### Slice 2.6：Parity Gate 與文件收尾

- 全套 `./tests/run.sh` 全綠（`dscontract` 的 runner 問題另行處理，不列為本段阻擋）。
- 更新 `DESIGN-SYSTEM.md` 第 7 節：確認純函式邊界與 React 對照。
- 更新 `README.md`「目前修改階段」。

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
| 計算结果與舊行為有細微差異 | 先補 parity 測試；保留 legacy fallback；逐片替換。 |
| 共用額度被重複扣除 | 純函式只回傳變更，由 adapter 統一提交；測試鎖住「只扣一次」。 |
| 日期／時區行為改變 | 日期一律由 adapter 以 `Asia/Taipei` 取得後傳入；純函式不讀時鐘。 |
| 卡片硬編碼轉通用時漏掉特例 | 先把特例寫成資料欄位或測試案例，再移除分支。 |

---

## 8. 下一步

進入 **Slice 2.3：排序與最佳方案純化**：

- 先補 `rankOffers` 的 parity 測試（交通／一般消費／特約商店的 winner 與排序）。
- 再把 `calculate()` 內的方案篩選、排序與基本回饋 fallback 搬進 `engine.js`。
- `index.html` 只保留讀取輸入、呼叫純函式、顯示結果的薄層。
