import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '@/lib/storage-keys';
import {
  loadLedger,
  loadLedgerUpdatedAt,
  loadRateState,
  loadRoom,
  loadRulesV3,
  migrateLocalData,
  readJson,
  readNumber,
  saveLedger,
  saveRateState,
  saveRoom,
  saveRulesV3,
} from '@/lib/storage';

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('rulesV3 storage', () => {
  it('沒有資料時載入預設卡表', () => {
    const rules = loadRulesV3();
    expect(rules.cards).toHaveLength(4);
    expect(rules.cards.reduce((sum, card) => sum + card.plans.length, 0)).toBe(6);
  });

  it('儲存後可讀回同一份卡表', () => {
    const rules = loadRulesV3();
    rules.cards[0].baseRate = 9;
    saveRulesV3(rules);

    const reloaded = loadRulesV3();
    expect(reloaded.cards[0].baseRate).toBe(9);
    expect(reloaded.cards[0].owned).toBe(true);
  });
});

describe('migrateLocalData', () => {
  it('把舊版記帳明細搬到 v2 key', () => {
    const oldLedger = JSON.stringify([{ id: 1, date: '11/13 10:00' }]);
    localStorage.setItem('japan_card_ledger', oldLedger);

    migrateLocalData();

    expect(localStorage.getItem(STORAGE_KEY.ledger)).toBe(oldLedger);
    expect(localStorage.getItem(STORAGE_KEY.migrated)).toBe('1');
  });

  it('不覆蓋已存在的 v2 記帳明細', () => {
    const oldLedger = JSON.stringify([{ id: 1 }]);
    const currentLedger = JSON.stringify([{ id: 2 }]);
    localStorage.setItem('japan_card_ledger', oldLedger);
    localStorage.setItem(STORAGE_KEY.ledger, currentLedger);

    migrateLocalData();

    expect(localStorage.getItem(STORAGE_KEY.ledger)).toBe(currentLedger);
  });

  it('只搬移一次', () => {
    localStorage.setItem(STORAGE_KEY.migrated, '1');
    localStorage.setItem('japan_card_ledger', JSON.stringify([{ id: 1 }]));

    migrateLocalData();

    expect(localStorage.getItem(STORAGE_KEY.ledger)).toBeNull();
  });
});

describe('ledger storage', () => {
  it('讀回合法陣列並忽略非物件項目', () => {
    localStorage.setItem(
      STORAGE_KEY.ledger,
      JSON.stringify([{ id: 1, twd: 100 }, null, 'bad', { id: 2, twd: 200 }]),
    );

    expect(loadLedger()).toEqual([
      { id: 1, twd: 100 },
      { id: 2, twd: 200 },
    ]);
  });

  it('格式錯誤時回傳空陣列', () => {
    localStorage.setItem(STORAGE_KEY.ledger, '{bad json');
    expect(loadLedger()).toEqual([]);
  });

  it('每次儲存都推進版本戳，即使同一毫秒', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-13T00:00:00Z'));

    const first = saveLedger([{ id: 1, date: '11/13 10:00' }]);
    const second = saveLedger([{ id: 1, date: '11/13 10:00' }]);

    expect(first).toBe(Date.now());
    expect(second).toBe(first + 1);
    expect(loadLedgerUpdatedAt()).toBe(second);
    expect(loadLedger()).toHaveLength(1);
  });
});

describe('rate and room storage', () => {
  it('沒有資料時使用預設匯率與即時模式', () => {
    expect(loadRateState()).toEqual({
      value: 0.2088,
      isLive: true,
      fetchTime: '',
      sourceTimestamp: 0,
      requestAt: 0,
    });
  });

  it('儲存後可讀回匯率狀態', () => {
    saveRateState({
      value: 0.215,
      isLive: false,
      fetchTime: '2026-11-13 10:00',
      sourceTimestamp: 123,
      requestAt: 456,
    });

    expect(loadRateState()).toEqual({
      value: 0.215,
      isLive: false,
      fetchTime: '2026-11-13 10:00',
      sourceTimestamp: 123,
      requestAt: 456,
    });
  });

  it('儲存後可讀回房間代碼', () => {
    saveRoom('ABC123');
    expect(loadRoom()).toBe('ABC123');
  });
});

describe('low-level storage helpers', () => {
  it('readJson 遇到壞資料時回傳 fallback', () => {
    localStorage.setItem('bad-json', '{bad');
    expect(readJson('bad-json', { ok: true })).toEqual({ ok: true });
  });

  it('readNumber 遇到非數字時回傳 fallback', () => {
    localStorage.setItem('bad-number', 'not-a-number');
    expect(readNumber('bad-number', 42)).toBe(42);
  });
});
