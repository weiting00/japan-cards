import { engine } from '@/lib/engine';
import type {
  DecisionAllocation,
  DecisionInput,
  DecisionResult,
  EngineOffer,
  ThresholdOpportunity,
} from '@/types/decision';

function roundTwd(jpy: number, rate: number): number {
  return Math.max(0, Math.round((Number(jpy) || 0) * rate));
}

function recalculate(
  offer: EngineOffer,
  amount: number,
  input: DecisionInput,
): DecisionAllocation {
  const result = engine.evaluatePlan({
    card: offer.card,
    plan: offer.plan,
    spendTwd: amount,
    merchant: input.merchant,
    contexts: input.contexts,
    today: input.today,
    dateParts: input.dateParts,
  });

  return {
    offer: result.offer,
    amount,
    partChanges: result.partChanges,
    periodReset: result.periodReset,
  };
}

function sameOffer(left: EngineOffer, right: EngineOffer): boolean {
  return left.card.id === right.card.id && left.plan.id === right.plan.id;
}

/**
 * 決策頁的純計算：只呼叫 engine.js，不在 React 內重寫推薦或拆刷規則。
 * 回傳的 partChanges 由呼叫端在「已刷卡」時套用，避免 render 期間寫入資料。
 */
export function calculateDecision(input: DecisionInput): DecisionResult {
  const totalTwd = roundTwd(input.amountJpy, input.rate);
  const ranked = engine.rankOffers({
    cards: input.rulesV3.cards,
    contexts: input.contexts,
    merchant: input.merchant,
    spendTwd: totalTwd,
    today: input.today,
    dateParts: input.dateParts,
    preferredCardId: input.preferredCardId,
    merchantIncludesGeneral: true,
  });

  if (totalTwd <= 0 || !ranked.offers.length) {
    return {
      totalTwd,
      ranked,
      allocations: [],
      totalReward: 0,
      isSplit: false,
      periodReset: ranked.periodReset,
    };
  }

  const best = ranked.offers[0];
  let allocations: DecisionAllocation[] = [recalculate(best, totalTwd, input)];

  if (input.splitMode === 'auto' && ranked.offers.length > 1 && !ranked.preferredApplied) {
    const splitPlan = engine.allocateSplit({
      offers: ranked.offers,
      spendTwd: totalTwd,
    });
    const split: DecisionAllocation[] = [];

    for (const entry of splitPlan.allocations) {
      const recalculated = recalculate(entry.offer, entry.amount, input);
      if (recalculated.offer.net > 0) split.push(recalculated);
    }

    let left = splitPlan.left;
    if (left > 0 && splitPlan.candidates.length) {
      const fallback = splitPlan.candidates.find((offer) => offer.includeBase) || splitPlan.candidates[0];
      const existing = split.find((item) => sameOffer(item.offer, fallback));
      if (existing) {
        existing.amount += left;
        const recalculated = recalculate(existing.offer, existing.amount, input);
        existing.offer = recalculated.offer;
        existing.partChanges = recalculated.partChanges;
        existing.periodReset = recalculated.periodReset;
      } else {
        split.push(recalculate(fallback, left, input));
      }
    }

    const splitReward = split.reduce((sum, item) => sum + item.offer.net, 0);
    if (split.length > 1 && splitReward > best.net + 1) allocations = split;
  }

  return {
    totalTwd,
    ranked,
    allocations,
    totalReward: allocations.reduce((sum, item) => sum + item.offer.net, 0),
    isSplit: allocations.length > 1,
    periodReset:
      ranked.periodReset || allocations.some((allocation) => allocation.periodReset),
  };
}

export function findThresholdOpportunity(input: {
  rulesV3: DecisionInput['rulesV3'];
  amountJpy: number;
  rate: number;
  contexts: string[];
  merchant: string;
  dateParts: DecisionInput['dateParts'];
  today: string;
}): ThresholdOpportunity | null {
  const twd = roundTwd(input.amountJpy, input.rate);
  if (twd <= 0 || input.rate <= 0) return null;

  const entries = engine.getQuotaState({
    cards: input.rulesV3.cards,
    dateParts: input.dateParts,
  });

  let best: (ThresholdOpportunity & { score: number }) | null = null;

  for (const entry of entries) {
    const threshold = Number(entry.threshold) || 0;
    const rate = Number(entry.rate) || 0;
    if (threshold <= 0 || rate <= 0) continue;

    const remaining = Math.max(0, (Number(entry.cap) || 0) - (Number(entry.used) || 0));
    if (remaining < threshold) continue;
    if (remaining / (rate / 100) < threshold) continue;
    if (twd >= threshold) continue;

    let targetJpy = Math.ceil(threshold / input.rate);
    while (Math.round(targetJpy * input.rate) < threshold) targetJpy += 1;
    const targetTwd = Math.round(targetJpy * input.rate);
    const evaluated = engine.evaluatePlan({
      card: entry.card,
      plan: entry.plan,
      spendTwd: threshold,
      merchant: input.merchant,
      contexts: input.contexts,
      today: input.today,
      dateParts: input.dateParts,
    });
    const netRate = threshold > 0 ? (evaluated.offer.net / threshold) * 100 : 0;
    if (netRate <= 0) continue;
    const score = netRate;

    if (best && score <= best.score) continue;
    best = {
      cardName: entry.card.name,
      planName: entry.plan.name,
      threshold,
      targetJpy,
      targetTwd,
      additionalJpy: Math.max(0, targetJpy - (Number(input.amountJpy) || 0)),
      additionalTwd: Math.max(0, targetTwd - twd),
      netRate,
      score,
    };
  }

  if (!best) return null;
  return {
    cardName: best.cardName,
    planName: best.planName,
    threshold: best.threshold,
    targetJpy: best.targetJpy,
    targetTwd: best.targetTwd,
    additionalJpy: best.additionalJpy,
    additionalTwd: best.additionalTwd,
    netRate: best.netRate,
  };
}

export function merchantTextFor(offer: EngineOffer): string {
  return engine.getMerchantText(offer.plan).trim();
}

export function planHasActualMerchantMatch(plan: EngineOffer['plan'], query: string): boolean {
  const text = engine.getMerchantText(plan).trim();
  const needle = String(query || '').trim();
  return Boolean(text && needle && engine.merchantTextMatches(plan, needle));
}

export function buildMerchantNote(input: {
  merchant: string;
  storeOffers: EngineOffer[];
  allocations: DecisionAllocation[];
  totalTwd: number;
  preferredCardId: string;
}): string | null {
  const merchant = input.merchant.trim();
  const chosen = input.allocations[0]?.offer;
  const storeBest = input.storeOffers[0];
  if (!merchant || !chosen || !storeBest) return null;

  const rate = (offer: EngineOffer) => formatRate(offerRatePercent(offer, input.totalTwd));
  const chosenRate = rate(chosen);
  const bestRate = rate(storeBest);

  const matched = input.storeOffers
    .filter((offer) => planHasActualMerchantMatch(offer.plan, merchant))
    .sort((left, right) => right.net - left.net);
  const topMerchantMatch = matched[0] || null;
  const bestIsMerchantMatch = planHasActualMerchantMatch(storeBest.plan, merchant);

  let primary: string;
  if (input.preferredCardId && chosen.card.id === input.preferredCardId && chosen.card.id !== storeBest.card.id) {
    primary = `目前依「${merchant}」試算，你指定 ${chosen.card.name}；這家店的最高淨回饋其實是 ${storeBest.card.name}（${bestRate}%）。`;
  } else if (chosen.card.id === storeBest.card.id) {
    primary = `目前依「${merchant}」試算，這家店最高淨回饋是 ${storeBest.card.name}（${bestRate}%）。`;
  } else {
    primary = `目前依「${merchant}」試算，這家店最高淨回饋是 ${storeBest.card.name}（${bestRate}%）；目前配置為 ${chosen.card.name}（${chosenRate}%）。`;
  }

  if (topMerchantMatch && !bestIsMerchantMatch && topMerchantMatch.net < storeBest.net - 0.01) {
    return `${primary} 雖然「${merchant}」符合 ${topMerchantMatch.card.name} 的特店條件（淨 ${rate(topMerchantMatch)}%），但 ${storeBest.card.name} 的一般消費淨 ${bestRate}% 更高。`;
  }

  return primary;
}

function formatRate(value: number): string {
  return value.toFixed(2);
}

export function offerRatePercent(offer: EngineOffer, totalTwd: number): number {
  return totalTwd > 0 ? (offer.net / totalTwd) * 100 : 0;
}
