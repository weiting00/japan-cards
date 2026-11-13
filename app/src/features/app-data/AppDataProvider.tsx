import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { LedgerEntry } from '@/lib/ledger';
import type { RulesV3 } from '@/lib/rules';
import type { RateState } from '@/lib/storage';
import {
  loadAppData,
  persistLedger,
  persistRate,
  persistRoom,
  persistRulesV3,
  type AppData,
} from '@/lib/app-data';

type Updater<T> = T | ((current: T) => T);

export type AppDataContextValue = {
  rulesV3: RulesV3;
  ledger: LedgerEntry[];
  ledgerUpdatedAt: number;
  rate: RateState;
  room: string;
  updateRulesV3: (updater: Updater<RulesV3>) => void;
  updateLedger: (updater: Updater<LedgerEntry[]>) => void;
  updateRate: (updater: Updater<RateState>) => void;
  updateRoom: (room: string) => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

function resolve<T>(updater: Updater<T>, current: T): T {
  return typeof updater === 'function' ? (updater as (value: T) => T)(current) : updater;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const dataRef = useRef(data);
  dataRef.current = data;

  const commit = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const updateRulesV3 = useCallback(
    (updater: Updater<RulesV3>) => {
      const next = resolve(updater, dataRef.current.rulesV3);
      persistRulesV3(next);
      commit({ ...dataRef.current, rulesV3: next });
    },
    [commit],
  );

  const updateLedger = useCallback(
    (updater: Updater<LedgerEntry[]>) => {
      const next = resolve(updater, dataRef.current.ledger);
      const ledgerUpdatedAt = persistLedger(next);
      commit({ ...dataRef.current, ledger: next, ledgerUpdatedAt });
    },
    [commit],
  );

  const updateRate = useCallback(
    (updater: Updater<RateState>) => {
      const next = resolve(updater, dataRef.current.rate);
      persistRate(next);
      commit({ ...dataRef.current, rate: next });
    },
    [commit],
  );

  const updateRoom = useCallback(
    (room: string) => {
      persistRoom(room);
      commit({ ...dataRef.current, room });
    },
    [commit],
  );

  const value = useMemo<AppDataContextValue>(
    () => ({
      ...data,
      updateRulesV3,
      updateLedger,
      updateRate,
      updateRoom,
    }),
    [data, updateLedger, updateRate, updateRoom, updateRulesV3],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData 必須在 AppDataProvider 內使用');
  return context;
}
