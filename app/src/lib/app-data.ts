import type { RulesV3 } from '@/lib/rules';
import type { LedgerEntry } from '@/lib/ledger';
import {
  loadLedger,
  loadLedgerUpdatedAt,
  loadRateState,
  loadRoom,
  loadRulesV3,
  migrateLocalData,
  saveLedger,
  saveRateState,
  saveRoom,
  saveRulesV3,
  type RateState,
} from '@/lib/storage';

export type AppData = {
  rulesV3: RulesV3;
  ledger: LedgerEntry[];
  ledgerUpdatedAt: number;
  rate: RateState;
  room: string;
};

export function loadAppData(): AppData {
  migrateLocalData();
  return {
    rulesV3: loadRulesV3(),
    ledger: loadLedger(),
    ledgerUpdatedAt: loadLedgerUpdatedAt(),
    rate: loadRateState(),
    room: loadRoom(),
  };
}

export function persistRulesV3(rulesV3: RulesV3): void {
  saveRulesV3(rulesV3);
}

export function persistLedger(ledger: LedgerEntry[]): number {
  return saveLedger(ledger);
}

export function persistRate(rate: RateState): void {
  saveRateState(rate);
}

export function persistRoom(room: string): void {
  saveRoom(room);
}
