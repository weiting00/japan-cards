import { engine } from '@/lib/engine';
import { formatLedgerDate, toDateTimeLocalValue, type DateParts } from '@/lib/date';
import type { LedgerEntry, LedgerUsage } from '@/lib/ledger';
import type { RewardPart, RulesV3, V3Plan } from '@/lib/rules';
import type { DecisionAllocation, PartChange } from '@/types/decision';

function cloneRules(rules: RulesV3): RulesV3 {
  return JSON.parse(JSON.stringify(rules)) as RulesV3;
}

function applyPartChange(plan: V3Plan, change: PartChange): void {
  const part = (plan.rewardParts || []).find((entry) => entry.id === change.partId);
  if (!part) return;
  if (change.periodKey !== undefined) part.periodKey = change.periodKey;
  if (change.cumulativePeriodKey !== undefined) part.cumulativePeriodKey = change.cumulativePeriodKey;
  if (change.usedReward !== undefined) part.usedReward = change.usedReward;
  if (change.cumulativeSpendTwd !== undefined) part.cumulativeSpendTwd = change.cumulativeSpendTwd;
}

function usageFor(usage: LedgerUsage[], partId: string): LedgerUsage {
  let record = usage.find((item) => item.partId === partId);
  if (!record) {
    record = { partId, amount: 0 };
    usage.push(record);
  }
  return record;
}

export function createLedgerRecords(input: {
  rulesV3: RulesV3;
  allocations: DecisionAllocation[];
  totalTwd: number;
  jpy: number;
  memo: string;
  now: Date;
  dateParts: DateParts;
  today: string;
  contexts: string[];
  merchant: string;
}): { rulesV3: RulesV3; records: LedgerEntry[] } {
  if (!input.allocations.length || input.totalTwd <= 0) {
    return { rulesV3: input.rulesV3, records: [] };
  }

  const rulesV3 = cloneRules(input.rulesV3);
  const baseMemo = input.memo.trim() || '未填寫明細';
  const records: LedgerEntry[] = [];
  let allocatedJpy = 0;

  input.allocations.forEach((allocation, index) => {
    const card = (rulesV3.cards || []).find((entry) => entry.id === allocation.offer.card.id);
    const plan = card && (card.plans || []).find((entry) => entry.id === allocation.offer.plan.id);
    if (!card || !plan) return;

    const result = engine.evaluatePlan({
      card,
      plan,
      spendTwd: allocation.amount,
      merchant: input.merchant,
      contexts: input.contexts,
      today: input.today,
      dateParts: input.dateParts,
    });
    for (const change of result.partChanges || []) applyPartChange(plan, change);

    const isLast = index === input.allocations.length - 1;
    const amountJpy = isLast
      ? input.jpy - allocatedJpy
      : Math.round((input.jpy * allocation.amount) / input.totalTwd);
    allocatedJpy += amountJpy;
    const reward = Math.round(result.offer.net);
    const usage: LedgerUsage[] = [];

    for (const partId of result.offer.cumulativePartIds || []) {
      const part = (plan.rewardParts || []).find((entry) => entry.id === partId);
      if (!part) continue;
      part.cumulativeSpendTwd = (Number(part.cumulativeSpendTwd) || 0) + allocation.amount;
      part.cumulativePeriodKey = part.periodKey || engine.getPeriodKey(plan, part, input.dateParts);
      const usageRecord = usageFor(usage, part.id);
      usageRecord.cumulativeSpendTwd =
        (Number(usageRecord.cumulativeSpendTwd) || 0) + allocation.amount;
    }

    for (const earned of result.offer.matchedParts || []) {
      const part = (plan.rewardParts || []).find((entry) => entry.id === earned.partId);
      if (!part) continue;
      const cap = Number(earned.cap ?? part.capAmount ?? plan.capAmount) || 0;
      if (cap <= 0) continue;
      part.usedReward = Math.min(
        cap,
        (Number(part.usedReward) || 0) + (Number(earned.reward) || 0),
      );
      const usageRecord = usageFor(usage, part.id);
      usageRecord.amount = (Number(usageRecord.amount) || 0) + (Number(earned.reward) || 0);
    }

    records.push({
      id: input.now.getTime() + index,
      date: formatLedgerDate(input.now),
      dateISO: toDateTimeLocalValue(input.now),
      memo:
        input.allocations.length > 1
          ? `${baseMemo}（拆刷 ${index + 1}/${input.allocations.length}）`
          : baseMemo,
      cardKey: `v3-${card.id}`,
      physicalCardId: card.id,
      v3PlanId: plan.id,
      cardName: card.name,
      ratePercent: allocation.amount ? Math.round((reward / allocation.amount) * 10000) / 100 : 0,
      jpy: amountJpy,
      twd: allocation.amount,
      rewardTwd: reward,
      ruleSnapshot: {
        v3: true,
        planName: plan.name,
        baseRate: card.baseRate,
        foreignFeeApplies: plan.foreignFeeApplies,
        capBasis: 'bonus',
      },
      v3Usage: usage,
    });
  });

  return { rulesV3, records };
}

export function partLabel(part: RewardPart): string {
  return part.name || '加碼回饋';
}
