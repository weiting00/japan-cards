import { engine } from '@/lib/engine';

export function EngineProof() {
  const billingLabel = engine.getCycleLabel({ cycle: 'billing', statementDay: 18 }, {});
  const monthReset = engine.getNextResetLabel(
    { cycle: 'month' },
    {},
    { year: 2026, month: 11, day: 13 },
  );

  return (
    <div className="engine-proof">
      <strong>engine.js 已連線</strong>
      <br />
      v{engine.version} · {billingLabel}
      <br />
      月週期下次重置：{monthReset}
    </div>
  );
}
