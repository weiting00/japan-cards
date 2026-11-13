# Stage 3 React app

這是第 3 段 React + shadcn/ui 遷移的工作區。正式入口仍是根目錄的 `index.html`；這個 app 目前提供路由外殼、`engine.js` bridge、共用資料層與決策頁，尚未取代舊版。

## 開發

```bash
cd app
npm install
npm run dev
```

Vite 預設會開 `http://localhost:5173`。

## 測試與建置

```bash
cd app
npm test
npm run typecheck
npm run build
npm run preview
```

## 邊界

- 計算只透過 `src/lib/engine.ts` 呼叫根目錄的 `engine.js`，不在 React 元件重寫規則。
- 決策計算集中在 `src/features/decision/calculate.ts`；加入記帳與 `partChanges` 套用在 `src/features/decision/record.ts`，render 期間不寫入資料。
- 資料層位於 `src/lib/rules.ts`、`storage.ts`、`app-data.ts` 與 `src/features/app-data/AppDataProvider.tsx`；沿用舊版 localStorage key 與資料格式。
- 視覺 token 先沿用目前 Cyber Neon Tokyo 主題，放在 `src/styles/globals.css`。
- 在 Slice 3.8 切換入口前，根目錄 `index.html` 與既有 `./tests/run.sh` 仍是 parity gate。
