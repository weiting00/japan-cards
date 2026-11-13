import { describe, expect, it } from 'vitest';
import { createDefaultRulesV3 } from '@/lib/rules';
import { formatTaipeiDate, getTaipeiDateParts } from '@/lib/date';
import {
  calculateDecision,
  findThresholdOpportunity,
  merchantTextFor,
  offerRatePercent,
} from '@/features/decision/calculate';
import { createLedgerRecords } from '@/features/decision/record';

const now = new Date('2026-11-13T04:00:00Z');
const dateParts = getTaipeiDateParts(now);
const today = formatTaipeiDate(now);

function input(overrides: Partial<Parameters<typeof calculateDecision>[0]> = {}) {
  return {
    rulesV3: createDefaultRulesV3(),
    contexts: ['general'],
    amountJpy: 10000,
    rate: 0.21,
    merchant: '',
    splitMode: 'single' as const,
    preferredCardId: '',
    dateParts,
    today,
    ...overrides,
  };
}

describe('calculateDecision', () => {
  it('一般消費回傳最高淨回饋方案', () => {
    const result = calculateDecision(input());
    expect(result.totalTwd).toBe(2100);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].offer.card.id).toBe('fubon_j');
    expect(result.allocations[0].offer.plan.id).toBe('plan-jcard-general');
    expect(result.allocations[0].offer.net).toBeCloseTo(94.5, 5);
    expect(result.totalReward).toBeCloseTo(94.5, 5);
    expect(result.isSplit).toBe(false);
  });

  it('特店命中時推薦特約方案，但一般方案仍可比較', () => {
    const result = calculateDecision(
      input({ contexts: ['merchant'], merchant: '松本清' }),
    );
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].offer.card.id).toBe('esun_kuma');
    expect(result.allocations[0].offer.plan.id).toBe('plan-kuma');
    expect(result.allocations[0].offer.net).toBeCloseTo(147, 5);
    expect(merchantTextFor(result.allocations[0].offer)).toContain('松本清');
  });

  it('金額為 0 時不產生配置', () => {
    const result = calculateDecision(input({ amountJpy: 0 }));
    expect(result.totalTwd).toBe(0);
    expect(result.allocations).toEqual([]);
    expect(result.totalReward).toBe(0);
  });

  it('拆分模式不會低於單卡最佳值', () => {
    const single = calculateDecision(input({ amountJpy: 300000, splitMode: 'single' }));
    const split = calculateDecision(input({ amountJpy: 300000, splitMode: 'auto' }));
    expect(split.totalReward).toBeGreaterThanOrEqual(single.totalReward);
    expect(split.allocations.length).toBeGreaterThanOrEqual(1);
  });

  it('offerRatePercent 以消費金額換算百分比', () => {
    const result = calculateDecision(input());
    expect(offerRatePercent(result.allocations[0].offer, result.totalTwd)).toBeCloseTo(4.5, 5);
  });
});

describe('findThresholdOpportunity', () => {
  it('金額未達單筆門檻時找出可補足的方案', () => {
    const rulesV3 = createDefaultRulesV3();
    const opportunity = findThresholdOpportunity({
      rulesV3,
      amountJpy: 500,
      rate: 0.21,
      contexts: ['general'],
      merchant: '',
      dateParts,
      today,
    });

    expect(opportunity).not.toBeNull();
    expect(opportunity?.threshold).toBe(1000);
    expect(opportunity?.targetJpy).toBeGreaterThan(500);
    expect(opportunity?.netRate).toBeGreaterThan(0);
    expect(opportunity?.targetTwd).toBeGreaterThanOrEqual(1000);
  });

  it('已達門檻時不回傳補足提示', () => {
    expect(
      findThresholdOpportunity({
        rulesV3: createDefaultRulesV3(),
        amountJpy: 10000,
        rate: 0.21,
        contexts: ['general'],
        merchant: '',
        dateParts,
        today,
      }),
    ).toBeNull();
  });
});

describe('createLedgerRecords', () => {
  it('建立明細並更新加碼已用額度', () => {
    const rulesV3 = createDefaultRulesV3();
    const decision = calculateDecision(
      input({ rulesV3, contexts: ['general'], amountJpy: 10000 }),
    );
    const recordedAt = new Date('2026-11-13T04:05:00Z');

    const result = createLedgerRecords({
      rulesV3,
      allocations: decision.allocations,
      totalTwd: decision.totalTwd,
      jpy: 10000,
      memo: '測試消費',
      now: recordedAt,
      dateParts,
      today,
      contexts: ['general'],
      merchant: '',
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      memo: '測試消費',
      physicalCardId: 'fubon_j',
      v3PlanId: 'plan-jcard-general',
      cardName: '富邦 J 卡',
      jpy: 10000,
      twd: 2100,
      rewardTwd: 95,
    });
    expect(result.records[0].v3Usage?.length).toBeGreaterThan(0);

    const card = result.rulesV3.cards.find((entry) => entry.id === 'fubon_j');
    const plan = card?.plans.find((entry) => entry.id === 'plan-jcard-general');
    const part = plan?.rewardParts.find((entry) => entry.id === 'part-jcard-general');
    expect(part?.usedReward).toBeGreaterThan(0);
    expect(part?.periodKey).toBe('2026-Q4');

    // 原始資料不被修改
    const originalCard = rulesV3.cards.find((entry) => entry.id === 'fubon_j');
    const originalPart = originalCard?.plans
      .find((entry) => entry.id === 'plan-jcard-general')
      ?.rewardParts.find((entry) => entry.id === 'part-jcard-general');
    expect(originalPart?.usedReward).toBe(0);
  });

  it('拆刷時建立多筆明細並分攤日幣金額', () => {
    const rulesV3 = createDefaultRulesV3();
    const decision = calculateDecision(
      input({ rulesV3, contexts: ['general'], amountJpy: 300000, splitMode: 'auto' }),
    );
    const result = createLedgerRecords({
      rulesV3,
      allocations: decision.allocations,
      totalTwd: decision.totalTwd,
      jpy: 300000,
      memo: '拆刷測試',
      now,
      dateParts,
      today,
      contexts: ['general'],
      merchant: '',
    });

    expect(result.records).toHaveLength(decision.allocations.length);
    expect(result.records.reduce((sum, record) => sum + (record.jpy || 0), 0)).toBe(300000);
    expect(result.records.every((record) => String(record.memo).startsWith('拆刷測試'))).toBe(true);
  });
});
