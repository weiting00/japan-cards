export type LedgerUsage = {
  partId: string;
  amount: number;
  cumulativeSpendTwd?: number;
  [key: string]: unknown;
};

export type LedgerEntry = {
  id: string | number;
  date: string;
  dateISO?: string;
  memo?: string;
  cardKey?: string;
  physicalCardId?: string;
  v3PlanId?: string;
  cardName?: string;
  ratePercent?: number;
  jpy?: number;
  twd?: number;
  rewardTwd?: number;
  ruleSnapshot?: Record<string, unknown>;
  v3Usage?: LedgerUsage[];
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeLedger(value: unknown): LedgerEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((entry) => ({ ...entry })) as LedgerEntry[];
}

export function normalizeLedgerUsage(value: unknown): LedgerUsage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((usage) => ({
      ...usage,
      partId: String(usage.partId || ''),
      amount: Math.max(0, Number(usage.amount) || 0),
      ...(usage.cumulativeSpendTwd !== undefined
        ? { cumulativeSpendTwd: Math.max(0, Number(usage.cumulativeSpendTwd) || 0) }
        : {}),
    }));
}
