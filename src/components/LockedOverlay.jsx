import { Lock } from 'lucide-react'

const TIER_JP = {
  member: 'メンバー',
  creator: 'クリエイター',
  producer: 'プロデューサー',
  partner: 'パートナー',
}

export default function LockedOverlay({ requiredTier = 'creator', feature = 'この機能' }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/75 backdrop-blur-[1px] rounded-xl">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
        <Lock className="w-5 h-5 text-slate-500" />
      </div>
      <div className="text-sm font-bold text-slate-700">{feature}はロック中</div>
      <div className="text-xs text-slate-500 mt-1">
        {TIER_JP[requiredTier] || requiredTier}プラン以上でアンロック
      </div>
    </div>
  )
}
