import { useAppData } from '@/features/app-data/AppDataProvider';

export function DataStatus() {
  const { rulesV3, ledger, rate } = useAppData();
  const planCount = rulesV3.cards.reduce((sum, card) => sum + card.plans.length, 0);

  return (
    <div className="engine-proof">
      <strong>共用資料層已連線</strong>
      <br />
      {rulesV3.cards.length} 張卡 · {planCount} 個方案 · {ledger.length} 筆記帳
      <br />
      匯率 1 JPY = {rate.value} TWD（{rate.isLive ? '即時' : '固定'}）
    </div>
  );
}
