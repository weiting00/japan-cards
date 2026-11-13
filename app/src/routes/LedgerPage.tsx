import { StagePlaceholder } from '@/components/StagePlaceholder';

export function LedgerPage() {
  return (
    <StagePlaceholder
      title="記帳明細"
      stage="Slice 3.5：明細列表、名稱／日期編輯、刪除與雲端同步"
    >
      這一頁會延續目前的 localStorage 與 Supabase 同步契約，並把表單改成 controlled state。
    </StagePlaceholder>
  );
}
