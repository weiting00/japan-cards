import type { V3Card, V3Plan } from '@/lib/rules';
import type { DateParts } from '@/lib/date';

export type MatchedPart = {
  partId: string;
  name: string;
  rate: number;
  reward: number;
  cap: number;
  remainingBefore: number;
  quotaGroupId: string | null;
};

export type EngineOffer = {
  card: V3Card;
  plan: V3Plan;
  spendTwd: number;
  base: number;
  bonus: number;
  fee: number;
  net: number;
  matchedParts: MatchedPart[];
  cumulativePartIds: string[];
  notes: string[];
  capSpend: number;
  includeBase: boolean;
  feeApplies: boolean;
};

export type PartChange = {
  partId: string;
  periodKey?: string;
  cumulativePeriodKey?: string;
  usedReward?: number;
  cumulativeSpendTwd?: number;
};

export type RankedPartChange = {
  cardId: string;
  planId: string;
  change: PartChange;
};

export type RankedOffers = {
  offers: EngineOffer[];
  storeOffers: EngineOffer[];
  storeBest: EngineOffer | null;
  preferredApplied: boolean;
  preferredCardId: string;
  partChanges: RankedPartChange[];
  periodReset: boolean;
};

export type SplitAllocation = {
  offer: EngineOffer;
  amount: number;
};

export type SplitPlan = {
  candidates: EngineOffer[];
  allocations: SplitAllocation[];
  left: number;
};

export type DecisionAllocation = SplitAllocation & {
  partChanges: PartChange[];
  periodReset: boolean;
};

export type DecisionResult = {
  totalTwd: number;
  ranked: RankedOffers;
  allocations: DecisionAllocation[];
  totalReward: number;
  isSplit: boolean;
  periodReset: boolean;
};

export type DecisionInput = {
  rulesV3: { cards: V3Card[] };
  contexts: string[];
  amountJpy: number;
  rate: number;
  merchant: string;
  splitMode: 'auto' | 'single';
  preferredCardId: string;
  dateParts: DateParts;
  today: string;
};

export type ThresholdOpportunity = {
  cardName: string;
  planName: string;
  threshold: number;
  targetJpy: number;
  targetTwd: number;
  additionalJpy: number;
  additionalTwd: number;
  netRate: number;
};
