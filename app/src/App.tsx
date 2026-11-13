import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { DecisionPage } from '@/routes/DecisionPage';
import { GuidePage } from '@/routes/GuidePage';
import { LedgerPage } from '@/routes/LedgerPage';
import { QuotasPage } from '@/routes/QuotasPage';
import { AppDataProvider } from '@/features/app-data/AppDataProvider';
import { cn } from '@/lib/utils';

const navigation = [
  { to: '/decision', label: '刷卡決策' },
  { to: '/quotas', label: '額度' },
  { to: '/ledger', label: '記帳' },
  { to: '/guide', label: '攻略' },
];

function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-kicker">Stage 3 · React migration</p>
          <h1 className="app-title">日本雙城刷卡決策與記帳助手</h1>
          <p className="app-subtitle">
            目前是 React + shadcn/ui 遷移外殼；原本的靜態版 <code>index.html</code> 仍是正式入口。
          </p>
        </div>
        <span className="engine-chip">engine.js only</span>
      </header>

      <nav className="app-nav" aria-label="主要頁面">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn('app-nav-link', isActive && 'is-active')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/decision" replace />} />
          <Route path="/decision" element={<DecisionPage />} />
          <Route path="/quotas" element={<QuotasPage />} />
          <Route path="/ledger" element={<LedgerPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="*" element={<Navigate to="/decision" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppDataProvider>
      <HashRouter>
        <AppShell />
      </HashRouter>
    </AppDataProvider>
  );
}
