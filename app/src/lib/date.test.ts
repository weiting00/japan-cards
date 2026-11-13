import { describe, expect, it } from 'vitest';
import {
  formatLedgerDate,
  formatTaipeiDate,
  getTaipeiDateParts,
  ledgerDateInputValue,
  ledgerDatePartsFromValue,
  pad2,
  toDateTimeLocalValue,
} from '@/lib/date';

describe('date helpers', () => {
  it('pad2 補零', () => {
    expect(pad2(1)).toBe('01');
    expect(pad2(10)).toBe('10');
    expect(pad2(100)).toBe('100');
  });

  it('用台北時區取得日期', () => {
    expect(getTaipeiDateParts(new Date('2026-11-12T16:30:00Z'))).toEqual({
      year: 2026,
      month: 11,
      day: 13,
    });
    expect(formatTaipeiDate(new Date('2026-11-12T16:30:00Z'))).toBe('2026-11-13');
  });

  it('格式化記帳日期與 datetime-local 值', () => {
    const date = new Date(2026, 0, 2, 3, 4);
    expect(formatLedgerDate(date)).toBe('01/02 03:04');
    expect(toDateTimeLocalValue(date)).toBe('2026-01-02T03:04');
  });

  it('從 datetime-local 值取出日期片段', () => {
    expect(ledgerDatePartsFromValue('2026-11-13T12:00')).toEqual({
      year: 2026,
      month: 11,
      day: 13,
    });
    expect(ledgerDatePartsFromValue('bad')).toBeNull();
  });
});

describe('ledgerDateInputValue', () => {
  const now = new Date(2026, 10, 13, 12, 0);

  it('優先使用 dateISO', () => {
    expect(ledgerDateInputValue({ dateISO: '2026-11-13T12:00', date: 'bad' }, now)).toBe(
      '2026-11-13T12:00',
    );
  });

  it('解析舊版月/日與下午時間', () => {
    expect(ledgerDateInputValue({ date: '11/12 下午 3:05' }, now)).toBe('2026-11-12T15:05');
  });

  it('解析英文 PM 與 12 點', () => {
    expect(ledgerDateInputValue({ date: '11/12 12:05 PM' }, now)).toBe('2026-11-12T12:05');
  });

  it('未來超過一天的舊資料視為去年', () => {
    expect(ledgerDateInputValue({ date: '12/31 10:00' }, now)).toBe('2025-12-31T10:00');
  });

  it('無法解析時使用現在時間', () => {
    expect(ledgerDateInputValue({ date: 'not a date' }, now)).toBe('2026-11-13T12:00');
  });
});
