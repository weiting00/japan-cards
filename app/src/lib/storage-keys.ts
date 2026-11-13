export const STORAGE_KEY = {
  rulesV3: 'japan_card_rules_v3',
  quotaMigration: 'japan_card_quota_migration_v1',
  billingPromptDismissed: 'japan_card_billing_prompt_dismissed_v1',
  ledger: 'japan_card_ledger_v2',
  ledgerUpdatedAt: 'japan_card_ledger_updated_at_v1',
  rate: 'japan_card_rate',
  rateLive: 'japan_card_rate_is_live',
  rateTime: 'japan_card_rate_time',
  rateRequestAt: 'japan_card_rate_request_at_v1',
  rateSourceTimestamp: 'japan_card_rate_source_timestamp_v1',
  room: 'japan_card_room',
  lastTab: 'japan_card_last_tab_v1',
  migrated: 'japan_card_migrated_v2',
  legacyLimits: 'japan_card_limits_v2',
  legacyQuotas: 'japan_card_quotas_v2',
} as const;

export type StorageKey = (typeof STORAGE_KEY)[keyof typeof STORAGE_KEY];
