import type {
  EngineOffer,
  RankedOffers,
  RankedPartChange,
  SplitPlan,
} from '@/types/decision';
import type { RewardPart, RulesV3, V3Card, V3Plan } from '@/lib/rules';

export type DateParts = {
  year: number;
  month: number;
  day: number;
};

export type QuotaEntry = {
  card: V3Card;
  plan: V3Plan;
  part: RewardPart;
  groupId: string | null;
  displayKey: string;
  members: RewardPart[];
  cap: number;
  used: number;
  remaining: number;
  threshold: number;
  rate: number;
  cycle: string;
  cycleLabel: string;
  nextResetLabel: string;
};

export type RuleEngineApi = {
  version: string;
  getPeriodKey(plan: unknown, part: unknown, dateParts: DateParts): string | null;
  getCycleLabel(plan: unknown, part: unknown): string;
  getNextResetDate(plan: unknown, part: unknown, dateParts: DateParts): DateParts | null;
  getNextResetLabel(plan: unknown, part: unknown, dateParts: DateParts): string;
  getQuotaState(input: { cards: unknown[]; dateParts: DateParts }): QuotaEntry[];
  planMatchesContexts(contexts: string[], selected: string[], options?: { merchantIncludesGeneral?: boolean }): boolean;
  parseMerchantText(text: string): string[];
  getMerchantText(plan: unknown): string;
  merchantTextMatches(plan: unknown, merchant: string): boolean;
  evaluatePlan(input: {
    card: unknown;
    plan: unknown;
    spendTwd: number;
    merchant?: string;
    contexts?: string[];
    today?: string;
    dateParts: DateParts;
  }): { offer: EngineOffer; partChanges: RankedPartChange['change'][]; periodReset: boolean };
  rankOffers(input: {
    cards: RulesV3['cards'];
    contexts: string[];
    merchant?: string;
    spendTwd: number;
    today?: string;
    dateParts: DateParts;
    preferredCardId?: string;
    merchantIncludesGeneral?: boolean;
  }): RankedOffers;
  allocateSplit(input: { offers: EngineOffer[]; spendTwd: number }): SplitPlan;
};

declare global {
  interface Window {
    RuleEngine?: RuleEngineApi;
  }
}
