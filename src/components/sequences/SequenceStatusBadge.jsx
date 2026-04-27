// シーケンスの状態を1行で示すバッジ
//   active : 🟢 自動配信中  (emerald)
//   draft  : 🟡 下書き      (amber)
//   error  : 🔴 配信エラー  (red)
//   empty  : ⚪ 未生成      (slate)
import { Zap, FileEdit, AlertTriangle, CircleDashed } from 'lucide-react'

const STATUS_MAP = {
  active: {
    label: '自動配信中',
    icon: Zap,
    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  draft: {
    label: '下書き',
    icon: FileEdit,
    cls: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  error: {
    label: '配信エラー',
    icon: AlertTriangle,
    cls: 'bg-red-100 text-red-700 border-red-200',
  },
  empty: {
    label: '未生成',
    icon: CircleDashed,
    cls: 'bg-slate-100 text-slate-500 border-slate-200',
  },
}

export default function SequenceStatusBadge({ status = 'empty', size = 'md' }) {
  const def = STATUS_MAP[status] || STATUS_MAP.empty
  const Icon = def.icon
  const sizeCls =
    size === 'sm'
      ? 'text-[10px] px-1.5 py-0.5 gap-1'
      : size === 'lg'
      ? 'text-sm px-3 py-1.5 gap-1.5 font-bold'
      : 'text-xs px-2 py-1 gap-1.5 font-bold'
  const iconCls =
    size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'
  return (
    <span
      className={`inline-flex items-center rounded-full border ${sizeCls} ${def.cls}`}
      data-sequence-status={status}
    >
      <Icon className={iconCls} />
      {def.label}
    </span>
  )
}
