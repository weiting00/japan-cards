# 設計系統 — Cyber Neon Tokyo v1

> 狀態：**第 1 段（皮膚）已完成**，全部改動都在 `<style>` 內，JS 與 HTML 結構 0 改動。
> 用途：① 固定現在的視覺契約 ② 第 3 段換 React + shadcn/ui 時的對照表。
> 這份文件只描述「長什麼樣、有哪些元件」，不描述商業邏輯。

---

## 1. 色彩

| Token | 值 | 用途 |
|---|---|---|
| `--bg` | `#0A0B1A` | 頁面底色（近黑藍） |
| `--card-bg` | `rgba(13, 17, 33, 0.72)` | 一般卡片（半透明） |
| `--card-sub-bg` | `#0B0E1E` | 卡片內次級區塊 |
| `--primary` | `#00F0FF` | 霓虹青：可操作、選中、強調 |
| `--primary-hover` | `#7DF4FF` | 青色 hover |
| `--accent` | `#FF00E5` | 霓虹洋紅：警示、超額、破壞性 |
| `--text` | `#E0E0E8` | 主要文字 |
| `--text-secondary` | `#8C9BAB` | 次要文字、說明 |
| `--green` | `#00E5A8` | 成功、免手續費 |
| `--warning` | `#FF9AEE` | 提醒（偏洋紅，維持雙色霓虹） |
| `--border` | `var(--a20)` | 一般邊框 |

### 青色透明度階梯（唯一允許的青色寫法）

`--a03 --a07 --a10 --a12 --a16 --a20 --a24 --a28 --a35 --a45 --a52 --a60 --a70`（共 13 階）

> **硬規則**：`:root` 之外不可出現 `rgba(0,240,255,…)` 字面值，一律用 `var(--aNN)`。
> `tests/dscontract.html` 的 A2 / A3 會直接抓違規。洋紅 `rgba(255,0,229,…)` 不受此限。

---

## 2. 形狀、間距、發光

| Token | 值 | 用途 |
|---|---|---|
| `--radius-lg` | `16px` | 卡片、對話框、抽屜、結果框 |
| `--radius-md` | `12px` | 按鈕、標籤、分頁、步進鈕 |
| `--radius-sm` | `10px` | 輸入框、下拉、小標籤 |
| `--shadow` | `0 0 24px var(--a10), 0 18px 40px rgba(0,0,0,.35)` | 卡片：霓虹外暈 + 下沉陰影 |

尺寸契約（**不可改**，`dscontract` B5–B16 會驗）：

`--control-h: 46px`、`--tap-min: 44px`、`--btn-h: 46px`、`--btn-sm-h: 32px`、
`--toggle-w/h/knob/travel`、`--page-width`、`--page-gutter`、`--field-gap`。

發光規則：

- 標題：`text-shadow: 0 0 14px var(--a35), 0 0 32px rgba(255,0,229,.18)`（青 + 洋紅雙色）
- 主按鈕：`box-shadow: 0 0 18px var(--a45), 0 0 46px var(--a24)`
- 卡片：`box-shadow: var(--shadow)`
- 輸入框聚焦：`inset 0 -2px var(--primary)` + `0 0 18px var(--a24)`
- 進度條：填滿處 `0 0 14px var(--a60)`

---

## 3. 標準元件（12 個）

第 3 段請直接照這張表建 shadcn 元件，**不要發明新名字**。

| # | 元件 | 現有 class | 變體 | shadcn/ui 對應 |
|---|---|---|---|---|
| 1 | Button | `.btn-main` `.btn-secondary` `.btn-small` | `default` `secondary` `sm` | `Button`（`variant` / `size`） |
| 2 | Card | `.card` `.card-title` | 一般 / 結果框 `result-box` | `Card` + `CardHeader` `CardTitle` `CardContent` |
| 3 | Input | `input` `select` | 文字 / 數字 / 下拉 | `Input` `Select` |
| 4 | Field | `label` + `.stepper-btn` | 純文字 / 數字（＋－） | `Form` `FormField` `Label` + `Button size="icon"` |
| 5 | Switch | `.toggle` `.toggle-track` | 開 / 關 | `Switch` |
| 6 | Tabs | `.nav-tabs` `.tab-btn` | 4 個固定分頁（底部） | `Tabs`（`position="fixed"`） |
| 7 | Dialog | `.modal-box` | 一般 / 危險（`.card-editor-danger`） | `Dialog` + `AlertDialog`（破壞性） |
| 8 | Sheet | `.editor-panel` | 卡片編輯 / 活動編輯 / 新增卡 | `Sheet`（行動版全螢幕） |
| 9 | Badge | `.rate-badge` `.badge-soft` `.cycle-tag` | `outline` `secondary` `warning` | `Badge` |
| 10 | Table | `.guide-table` `.guide-table-wrap` | 攻略比較表 | `Table` |
| 11 | Progress | `.progress-bar` `.progress-fill` | 額度使用率 | `Progress` |
| 12 | Alert / Toast | `.alert-box` `.over-limit-alert` `.split-plan-box` `.toast` | `default` `destructive` `toast` | `Alert` + `Sonner` |

---

## 4. 語意例外（皮膚不可吃掉）

這三種框有「意義」，測試會擋：

| 元素 | 邊框 | 理由 |
|---|---|---|
| `.guide-card` | `rgba(255,255,255,.16)` 淺色 | 攻略卡要和資料卡區隔（`layout2` D 項） |
| `.card-editor-danger` | `rgba(255,140,150,.55)` 紅 | 刪卡、危險操作 |
| `.over-limit-alert` / `.split-plan-box` | `rgba(255,0,229,.42)` 洋紅 | 超額、分期警示 |

底部導覽 `.nav-tabs` 維持 **直角**（滿版 bar，圓角會破版）。

---

## 5. 第 1 段「可以 / 不可以」

| 可以 | 不可以 |
|---|---|
| 改 `className`、CSS 變數、顏色、邊框、圓角、陰影、發光 | 改 JS 邏輯、事件、state |
| 新增純 CSS 規則（有標記區塊） | 改 DOM 結構、元件階層 |
| 改 `!important` 覆蓋順序 | 改元件高度 / 內距（尺寸契約） |
| 加 `style` 屬性 | 加新元件名稱 |

---

## 6. 驗收

| 測試 | 內容 |
|---|---|
| `tests/skin.html` | 視覺契約：底色、霓虹青/洋紅、圓角階梯、發光存在、語意例外、結構未變 |
| `tests/dscontract.html` | 元件契約：13 階青色 token、欄位/按鈕/開關一致性、高度契約 |
| `tests/layout2.html` | 版面契約：主要區塊有可見外框、攻略卡淺框、危險區紅框 |
| 全站 | `./tests/run.sh` → **395 passed, 0 failed** |

---

## 7. 第 3 段遷移對照（備忘）

1. `index.html` 的 4 個頁面 → 4 個 route（`decision` / `quotas` / `ledger` / `guide`）
2. `.tab-btn` 的 `switchTab(name)` → `Tabs` + router；`active` class 由 state 決定
3. `.modal-box` / `.editor-panel` 的 `hidden` 切換 → `Dialog` / `Sheet` 的 `open`
4. `document.querySelector(...).value` 讀值 → controlled `useState`（第 2 段先把計算抽成純函式）
5. 皮膚：把本文件第 1–2 節的 token 直接放進 `globals.css`，元件用 shadcn 預設 + 這裡的 class 覆蓋
