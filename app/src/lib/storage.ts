import { STORAGE_KEY } from '@/lib/storage-keys';
import { normalizeV3Rules, type RulesV3 } from '@/lib/rules';
import { normalizeLedger, type LedgerEntry } from '@/lib/ledger';

export type RateState = {
  value: number;
  isLive: boolean;
  fetchTime: string;
  sourceTimestamp: number;
  requestAt: number;
};

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readString(key: string, fallback = ''): string {
  const storage = getStorage();
  if (!storage) return fallback;
  const value = storage.getItem(key);
  return value === null ? fallback : value;
}

export function writeString(key: string, value: string): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, value);
}

export function readNumber(key: string, fallback = 0): number {
  const value = Number(readString(key));
  return Number.isFinite(value) ? value : fallback;
}

export function writeNumber(key: string, value: number): void {
  writeString(key, String(value));
}

export function readJson<T>(key: string, fallback: T): T {
  const storage = getStorage();
  if (!storage) return fallback;
  const raw = storage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  writeString(key, JSON.stringify(value));
}

/**
 * 舊版本資料自動搬移（v1 → v2）。
 * 與 index.html 相同：只搬記帳明細，且只搬一次。
 */
export function migrateLocalData(): void {
  const storage = getStorage();
  if (!storage) return;
  if (storage.getItem(STORAGE_KEY.migrated)) return;

  const oldLedger = storage.getItem('japan_card_ledger');
  if (oldLedger && !storage.getItem(STORAGE_KEY.ledger)) {
    storage.setItem(STORAGE_KEY.ledger, oldLedger);
  }

  storage.setItem(STORAGE_KEY.migrated, '1');
}

export function loadRulesV3(): RulesV3 {
  const current = readJson<unknown>(STORAGE_KEY.rulesV3, null);
  return current ? normalizeV3Rules(current) : normalizeV3Rules(null);
}

export function saveRulesV3(rules: RulesV3): void {
  writeJson(STORAGE_KEY.rulesV3, rules);
}

export function loadLedger(): LedgerEntry[] {
  return normalizeLedger(readJson<unknown>(STORAGE_KEY.ledger, []));
}

export function loadLedgerUpdatedAt(): number {
  return readNumber(STORAGE_KEY.ledgerUpdatedAt, 0);
}

export function saveLedger(ledger: LedgerEntry[]): number {
  const previous = readNumber(STORAGE_KEY.ledgerUpdatedAt, 0);
  const updatedAt = Math.max(Date.now(), previous + 1);
  writeJson(STORAGE_KEY.ledger, ledger);
  writeNumber(STORAGE_KEY.ledgerUpdatedAt, updatedAt);
  return updatedAt;
}

export function loadRateState(): RateState {
  const storedRate = parseFloat(readString(STORAGE_KEY.rate));
  return {
    value: Number.isFinite(storedRate) && storedRate > 0 ? storedRate : 0.2088,
    isLive: readString(STORAGE_KEY.rateLive, 'true') !== 'false',
    fetchTime: readString(STORAGE_KEY.rateTime),
    sourceTimestamp: readNumber(STORAGE_KEY.rateSourceTimestamp, 0),
    requestAt: readNumber(STORAGE_KEY.rateRequestAt, 0),
  };
}

export function saveRateState(state: RateState): void {
  writeString(STORAGE_KEY.rate, String(state.value));
  writeString(STORAGE_KEY.rateLive, state.isLive ? 'true' : 'false');
  writeString(STORAGE_KEY.rateTime, state.fetchTime);
  writeNumber(STORAGE_KEY.rateSourceTimestamp, state.sourceTimestamp);
  writeNumber(STORAGE_KEY.rateRequestAt, state.requestAt);
}

export function loadRoom(): string {
  return readString(STORAGE_KEY.room);
}

export function saveRoom(room: string): void {
  writeString(STORAGE_KEY.room, room);
}
