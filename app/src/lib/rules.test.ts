import { describe, expect, it } from 'vitest';
import {
  createDefaultRulesV3,
  normalizeV3Cycle,
  normalizeV3Rules,
} from '@/lib/rules';

describe('createDefaultRulesV3', () => {
  it('建立 4 張卡、6 個方案', () => {
    const rules = createDefaultRulesV3();
    expect(rules.version).toBe(1);
    expect(rules.updatedAt).toBe(0);
    expect(rules.cards).toHaveLength(4);
    expect(rules.cards.reduce((sum, card) => sum + card.plans.length, 0)).toBe(6);
  });

  it('每次呼叫都建立獨立物件', () => {
    const first = createDefaultRulesV3();
    const second = createDefaultRulesV3();
    first.cards[0].plans[0].rewardParts[0].usedReward = 999;
    expect(second.cards[0].plans[0].rewardParts[0].usedReward).toBe(0);
  });
});

describe('normalizeV3Cycle', () => {
  it('轉換中文與英文週期', () => {
    expect(normalizeV3Cycle('每月')).toBe('month');
    expect(normalizeV3Cycle('每季')).toBe('quarter');
    expect(normalizeV3Cycle('帳單週期')).toBe('billing');
    expect(normalizeV3Cycle('活動期間')).toBe('campaign');
    expect(normalizeV3Cycle('none')).toBe('none');
    expect(normalizeV3Cycle(undefined)).toBe('none');
  });
});

describe('normalizeV3Rules', () => {
  it('沒有有效 cards 時回傳預設資料', () => {
    expect(normalizeV3Rules(null).cards).toHaveLength(4);
    expect(normalizeV3Rules({ cards: 'bad' }).cards).toHaveLength(4);
  });

  it('正規化舊版 context / parts / cap / merchant 欄位', () => {
    const input = {
      updatedAt: 123,
      cards: [
        {
          id: 'legacy-card',
          name: '舊卡',
          baseRate: '2.5',
          owned: false,
          plans: [
            {
              id: 'legacy-plan',
              name: '舊方案',
              context: 'direct',
              cycle: '每月',
              includeBaseReward: false,
              foreignFeeApplies: false,
              merchants: ['A', ' B ', ''],
              parts: [
                {
                  id: 'legacy-part',
                  rate: '5',
                  cap: '1000',
                  used: '200',
                  threshold: '300',
                  merchant: 'X, Y',
                },
              ],
            },
          ],
        },
      ],
    };

    const normalized = normalizeV3Rules(input);
    const card = normalized.cards[0];
    const plan = card.plans[0];
    const part = plan.rewardParts[0];

    expect(normalized.version).toBe(1);
    expect(normalized.updatedAt).toBe(123);
    expect(card.owned).toBe(true);
    expect(card.baseRate).toBe(2.5);
    expect(plan.contexts).toEqual(['general']);
    expect(plan.cycle).toBe('month');
    expect(plan.includeBaseReward).toBe(false);
    expect(plan.foreignFeeApplies).toBe(false);
    expect(plan.merchantText).toBe('A、B');
    expect(part.cycle).toBe('month');
    expect(part.rate).toBe(5);
    expect(part.capAmount).toBe(1000);
    expect(part.usedReward).toBe(200);
    expect(part.thresholdTwd).toBe(300);
    expect(part.merchants).toEqual(['X', 'Y']);
  });

  it('不修改傳入物件', () => {
    const input = {
      cards: [
        {
          id: 'card',
          plans: [{ id: 'plan', parts: [{ id: 'part', rate: 3 }] }],
        },
      ],
    };

    normalizeV3Rules(input);

    expect(input.cards[0].plans[0]).toEqual({
      id: 'plan',
      parts: [{ id: 'part', rate: 3 }],
    });
  });

  it('保留未知欄位並清掉負數', () => {
    const normalized = normalizeV3Rules({
      cards: [
        {
          id: 'card',
          name: '卡',
          custom: 'keep',
          baseRate: -1,
          plans: [
            {
              id: 'plan',
              name: '方案',
              rewardParts: [
                {
                  id: 'part',
                  name: '加碼',
                  rate: -2,
                  capAmount: -3,
                  usedReward: -4,
                  thresholdTwd: -5,
                  customPart: 'keep',
                },
              ],
            },
          ],
        },
      ],
    });

    expect(normalized.cards[0].custom).toBe('keep');
    expect(normalized.cards[0].baseRate).toBe(0);
    expect(normalized.cards[0].plans[0].rewardParts[0].customPart).toBe('keep');
    expect(normalized.cards[0].plans[0].rewardParts[0]).toMatchObject({
      rate: 0,
      capAmount: 0,
      usedReward: 0,
      thresholdTwd: 0,
    });
  });
});
