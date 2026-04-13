// ティア別機能制御（Supabase連携モード用）

export const TIERS = ['member', 'creator', 'producer', 'partner']

export const TIER_LABELS = {
  member: 'メンバー',
  creator: 'クリエイター',
  producer: 'プロデューサー',
  partner: 'パートナー',
}

// 機能ごとの必要ティア
export const FEATURE_REQUIREMENTS = {
  bulk_subscriber_ops: 'creator',
  create_campaign: 'creator',
  schedule_campaign: 'creator',
  csv_export: 'creator',
  create_group: 'creator',
  automation_toggle: 'producer',
  webhook_notify: 'producer',
  schedule_manager: 'producer',
}

export function canUse(userTier, feature) {
  const required = FEATURE_REQUIREMENTS[feature]
  if (!required) return true
  return TIERS.indexOf(userTier) >= TIERS.indexOf(required)
}

export function getRequiredTier(feature) {
  return FEATURE_REQUIREMENTS[feature] || 'member'
}
