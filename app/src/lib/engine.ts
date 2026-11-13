import '../../../engine.js';
import type { RuleEngineApi } from '@/types/engine';

/**
 * Stage 3 期間 engine.js 仍是唯一的計算核心。
 * 這裡只做型別包裝，不重新實作任何規則。
 */
export const engine = window.RuleEngine as RuleEngineApi;

if (!engine) {
  throw new Error('RuleEngine 未載入；請確認 engine.js 已正確匯入。');
}
