export const FEATURED_MERCHANTS = [
  '松本清',
  'Cocokara Fine',
  '唐吉訶德',
  '大國藥妝',
  'BicCamera',
  'Yodobashi',
  'Edion',
  "K's Denki",
  'UNIQLO',
  'GU',
];

export type V3Cycle = 'month' | 'quarter' | 'billing' | 'campaign' | 'none' | string;

export type RewardPart = {
  id: string;
  name: string;
  rate: number;
  capAmount: number;
  usedReward: number;
  cycle: V3Cycle;
  thresholdTwd: number;
  thresholdType: string;
  start: string;
  end: string;
  quotaGroupId?: string | null;
  periodKey?: string | null;
  cumulativePeriodKey?: string | null;
  cumulativeSpendTwd?: number;
  merchants?: string[];
  merchant?: string;
  [key: string]: unknown;
};

export type V3Plan = {
  id: string;
  name: string;
  contexts: string[];
  cycle: V3Cycle;
  includeBaseReward: boolean;
  foreignFeeApplies: boolean;
  merchantText?: string;
  merchants?: string[];
  statementDay?: number | null;
  rewardParts: RewardPart[];
  [key: string]: unknown;
};

export type V3Card = {
  id: string;
  name: string;
  issuer?: string;
  network?: string;
  baseRate: number;
  baseFeeApplies?: boolean;
  owned?: boolean;
  plans: V3Plan[];
  [key: string]: unknown;
};

export type RulesV3 = {
  version: number;
  updatedAt: number;
  cards: V3Card[];
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOrZero(value: unknown): number {
  return Math.max(0, Number(value) || 0);
}

function makePart(
  id: string,
  name: string,
  rate: number,
  capAmount: number,
  cycle: V3Cycle,
  thresholdTwd: number,
): RewardPart {
  return {
    id,
    name,
    rate,
    capAmount,
    usedReward: 0,
    cycle,
    thresholdTwd,
    thresholdType: 'single',
    start: '',
    end: '',
  };
}

/**
 * 內建預設卡片資料（v3 結構）。這是資料的唯一種子；
 * 使用者於「攻略守則 → 編輯」新增的卡片會併入同一份 rulesV3。
 */
export function createDefaultRulesV3(): RulesV3 {
  return {
    version: 1,
    updatedAt: 0,
    cards: [
      {
        id: 'fubon_j',
        name: '富邦 J 卡',
        issuer: '富邦',
        network: 'Visa',
        baseRate: 3,
        baseFeeApplies: true,
        owned: true,
        plans: [
          {
            id: 'plan-jcard-transit',
            legacyKey: 'jcard_transit',
            name: '富邦 J 卡 (交通卡 AP 儲值)',
            contexts: ['transit'],
            includeBaseReward: true,
            foreignFeeApplies: true,
            noticeFlags: false,
            merchants: [],
            locationNotice: false,
            thresholdTwd: 2000,
            thresholdType: 'single',
            capAmount: 200,
            cycle: 'quarter',
            statementDay: null,
            capBasis: 'bonus',
            fallbackBase: true,
            enabled: true,
            rewardParts: [makePart('part-jcard-transit', '加碼回饋', 7, 200, 'quarter', 2000)],
          },
          {
            id: 'plan-jcard-general',
            legacyKey: 'jcard',
            name: '富邦 J 卡 (日韓實體一般消費)',
            contexts: ['general', 'transit'],
            includeBaseReward: true,
            foreignFeeApplies: true,
            noticeFlags: false,
            merchants: [],
            locationNotice: false,
            thresholdTwd: 1000,
            thresholdType: 'single',
            capAmount: 1000,
            cycle: 'quarter',
            statementDay: null,
            capBasis: 'bonus',
            fallbackBase: true,
            enabled: true,
            rewardParts: [makePart('part-jcard-general', '加碼回饋', 3, 1000, 'quarter', 1000)],
          },
        ],
      },
      {
        id: 'esun_kuma',
        name: '玉山熊本熊卡',
        issuer: '玉山',
        network: 'Visa',
        baseRate: 2.5,
        baseFeeApplies: true,
        owned: true,
        plans: [
          {
            id: 'plan-kuma',
            legacyKey: 'kuma',
            name: '玉山熊本熊卡 (指定特店 / 交通)',
            contexts: ['transit', 'merchant'],
            includeBaseReward: true,
            foreignFeeApplies: true,
            noticeFlags: false,
            merchantText: FEATURED_MERCHANTS.join('、'),
            locationNotice: true,
            thresholdTwd: 0,
            thresholdType: 'single',
            capAmount: 500,
            cycle: 'billing',
            statementDay: null,
            capBasis: 'bonus',
            fallbackBase: true,
            enabled: true,
            rewardParts: [makePart('part-kuma', '加碼回饋', 6, 500, 'billing', 0)],
          },
          {
            id: 'plan-paypay',
            legacyKey: 'paypay',
            name: '玉山 Wallet 綁熊本熊 (PayPay)',
            contexts: ['paypay'],
            includeBaseReward: false,
            foreignFeeApplies: false,
            noticeFlags: false,
            merchants: [],
            locationNotice: false,
            thresholdTwd: 0,
            thresholdType: 'single',
            capAmount: 100,
            cycle: 'quarter',
            statementDay: null,
            capBasis: 'net',
            fallbackBase: false,
            enabled: true,
            rewardParts: [makePart('part-paypay', '加碼回饋', 3.5, 100, 'quarter', 0)],
          },
        ],
      },
      {
        id: 'fubon_costco',
        name: '富邦 Costco 聯名卡',
        issuer: '富邦',
        network: 'Visa',
        baseRate: 1,
        baseFeeApplies: true,
        owned: true,
        plans: [
          {
            id: 'plan-costco',
            legacyKey: 'costco',
            name: '富邦 Costco 聯名卡 (海外實體)',
            contexts: ['general', 'transit'],
            includeBaseReward: true,
            foreignFeeApplies: true,
            noticeFlags: false,
            merchants: [],
            locationNotice: false,
            thresholdTwd: 0,
            thresholdType: 'single',
            capAmount: 600,
            cycle: 'month',
            statementDay: null,
            capBasis: 'bonus',
            fallbackBase: true,
            enabled: true,
            rewardParts: [makePart('part-costco', '加碼回饋', 4, 600, 'month', 0)],
          },
        ],
      },
      {
        id: 'cathay_cube',
        name: '國泰 CUBE 卡',
        issuer: '國泰',
        network: 'Visa',
        baseRate: 3,
        baseFeeApplies: true,
        owned: true,
        plans: [
          {
            id: 'plan-cube',
            legacyKey: 'cube',
            name: '國泰 CUBE 卡 (趣旅行)',
            contexts: ['general', 'transit'],
            includeBaseReward: true,
            foreignFeeApplies: true,
            noticeFlags: false,
            merchants: [],
            locationNotice: false,
            thresholdTwd: 0,
            thresholdType: 'single',
            capAmount: 0,
            cycle: 'none',
            statementDay: null,
            capBasis: 'bonus',
            fallbackBase: true,
            enabled: true,
            rewardParts: [],
          },
        ],
      },
    ],
  };
}

export function normalizeV3Cycle(value: unknown): V3Cycle {
  const labels: Record<string, V3Cycle> = {
    每月: 'month',
    每季: 'quarter',
    帳單週期: 'billing',
    活動期間: 'campaign',
    不追蹤上限: 'none',
    none: 'none',
  };
  const key = String(value || '');
  return labels[key] || (key || 'none');
}

function normalizeRewardPart(value: unknown, planCycle: V3Cycle): RewardPart {
  const part = isRecord(value) ? value : {};
  const cycle = normalizeV3Cycle(part.cycle || planCycle);
  const merchants = Array.isArray(part.merchants)
    ? part.merchants.map((name) => String(name).trim()).filter(Boolean)
    : part.merchant
      ? String(part.merchant)
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean)
      : undefined;

  return {
    ...part,
    id: String(part.id || ''),
    name: String(part.name || '加碼回饋'),
    cycle,
    ...(merchants !== undefined ? { merchants } : {}),
    rate: numberOrZero(part.rate),
    capAmount: numberOrZero(part.capAmount ?? part.cap),
    usedReward: numberOrZero(part.usedReward ?? part.used),
    thresholdTwd: numberOrZero(part.thresholdTwd ?? part.threshold),
    thresholdType: String(part.thresholdType || 'single'),
    start: String(part.start || ''),
    end: String(part.end || ''),
  };
}

function normalizePlan(value: unknown): V3Plan {
  const plan = isRecord(value) ? value : {};
  const contexts = Array.isArray(plan.contexts) ? plan.contexts : [plan.context || 'general'];
  const merchantText =
    typeof plan.merchantText === 'string' && plan.merchantText.trim()
      ? plan.merchantText
      : Array.isArray(plan.merchants)
        ? plan.merchants
            .map((name) => String(name).trim())
            .filter(Boolean)
            .join('、')
        : '';
  const rewardParts = Array.isArray(plan.rewardParts)
    ? plan.rewardParts
    : Array.isArray(plan.parts)
      ? plan.parts
      : [];
  const cycle = normalizeV3Cycle(plan.cycle);

  return {
    ...plan,
    id: String(plan.id || ''),
    name: String(plan.name || ''),
    contexts: contexts.map((context) => (context === 'direct' ? 'general' : String(context))),
    cycle,
    includeBaseReward: plan.includeBaseReward !== false,
    foreignFeeApplies: plan.foreignFeeApplies !== false,
    merchantText,
    rewardParts: rewardParts.map((part) => normalizeRewardPart(part, cycle)),
  };
}

/**
 * 將舊版／缺欄位的 rulesV3 正規化成目前結構。
 * 純函式：不修改傳入物件，回傳新的 cards / plans / rewardParts。
 */
export function normalizeV3Rules(value: unknown): RulesV3 {
  if (!isRecord(value) || !Array.isArray(value.cards)) return createDefaultRulesV3();

  const cards = value.cards.map((rawCard) => {
    const card = isRecord(rawCard) ? rawCard : {};
    const plans = Array.isArray(card.plans) ? card.plans : [];
    return {
      ...card,
      id: String(card.id || ''),
      name: String(card.name || ''),
      owned: true,
      baseRate: numberOrZero(card.baseRate),
      plans: plans.map(normalizePlan),
    };
  });

  return {
    ...value,
    version: 1,
    updatedAt: Number(value.updatedAt) || 0,
    cards,
  };
}
