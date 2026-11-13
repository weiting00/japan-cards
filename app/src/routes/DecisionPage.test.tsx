import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppDataProvider, useAppData } from '@/features/app-data/AppDataProvider';
import { DecisionPage } from '@/routes/DecisionPage';

function LedgerProbe() {
  const { ledger } = useAppData();
  return <div>{`ledger-count-${ledger.length}`}</div>;
}

function renderDecision() {
  return render(
    <AppDataProvider>
      <MemoryRouter initialEntries={['/decision']}>
        <Routes>
          <Route path="/decision" element={<DecisionPage />} />
          <Route path="/ledger" element={<LedgerProbe />} />
        </Routes>
      </MemoryRouter>
    </AppDataProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('DecisionPage', () => {
  it('輸入金額後顯示推薦卡片與淨回饋', () => {
    renderDecision();

    fireEvent.change(screen.getByLabelText('結帳金額 (日幣 JPY)'), {
      target: { value: '10000' },
    });

    expect(screen.getAllByText('富邦 J 卡').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4\.50%/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('NT$94').length).toBeGreaterThan(0);
  });

  it('切到特約商店並輸入店名後推薦特約方案', () => {
    renderDecision();

    fireEvent.change(screen.getByLabelText('結帳金額 (日幣 JPY)'), {
      target: { value: '10000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /特約商店/ }));
    fireEvent.change(screen.getByLabelText('特約商店'), {
      target: { value: '松本清' },
    });

    expect(screen.getAllByText('玉山熊本熊卡').length).toBeGreaterThan(0);
    expect(screen.getAllByText('NT$146').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '用店家搜尋其他卡片' }));
    expect(screen.getByText(/方案原文命中/)).toBeTruthy();
  });

  it('特店有命中但一般消費淨回饋更高時顯示比較原因', () => {
    renderDecision();

    fireEvent.change(screen.getByLabelText('結帳金額 (日幣 JPY)'), {
      target: { value: '150000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /特約商店/ }));
    fireEvent.change(screen.getByLabelText('特約商店'), {
      target: { value: '松本清' },
    });

    expect(screen.getByText(/雖然「松本清」符合/)).toBeTruthy();
    expect(screen.getByText(/一般消費淨/)).toBeTruthy();
  });

  it('已刷卡後建立明細並導到記帳頁', () => {
    renderDecision();

    fireEvent.change(screen.getByLabelText('結帳金額 (日幣 JPY)'), {
      target: { value: '10000' },
    });
    fireEvent.click(screen.getByRole('button', { name: '已刷卡，加入記帳' }));

    expect(screen.getByText('ledger-count-1')).toBeTruthy();
  });
});
