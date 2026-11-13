import { StagePlaceholder } from '@/components/StagePlaceholder';

export function QuotasPage() {
  return (
    <StagePlaceholder
      title="額度看板"
      stage="Slice 3.4：額度分組、進度條、單筆／全部重置與帳單結帳日提示"
    >
      額度資料已由 <code>engine.getQuotaState()</code> 提供；React 這一頁只負責呈現與重置操作。
    </StagePlaceholder>
  );
}
