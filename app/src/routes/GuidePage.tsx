import { StagePlaceholder } from '@/components/StagePlaceholder';

export function GuidePage() {
  return (
    <StagePlaceholder
      title="攻略守則"
      stage="Slice 3.6：卡片／方案列表、加碼活動編輯、新增卡與新增方案"
    >
      攻略頁的資料模型會沿用 <code>rulesV3</code>；編輯器會改用 shadcn 的 Dialog／Sheet 與
      controlled form。
    </StagePlaceholder>
  );
}
