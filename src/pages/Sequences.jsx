import { useEffect, useState } from 'react'
import {
  Workflow,
  Loader2,
  AlertCircle,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Sparkles,
  Trash2,
  RefreshCw,
  ChevronRight,
  Info,
} from 'lucide-react'
import { supabase, isSupabaseMode } from '../lib/supabase'
import { canUse } from '../lib/tiers'
import { NotConnected } from './Dashboard'
import LockedOverlay from '../components/LockedOverlay'

/**
 * シーケンス（ステップメール）管理ページ
 *
 * Brevoにはオートメーション機能がないため、Supabaseの generated_step_contents テーブルに
 * 保存された「AI生成済みのステップメールテンプレート」をシーケンスとして一覧表示し、
 * delivery_queue テーブルで管理される配信予約の進捗を確認する。
 *
 * 実際の配信予約は Campaigns ページの「自動配信セットアップ」から行う。
 */
export default function Sequences({ isConnected, connection, userTier, setCurrentPage }) {
  const [tab, setTab] = useState('sequences') // sequences | queue
  const [sequences, setSequences] = useState([])
  const [queueItems, setQueueItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedFunnelId, setExpandedFunnelId] = useState(null)

  useEffect(() => {
    if (isConnected) load()
  }, [isConnected, tab])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      if (tab === 'sequences') {
        await loadSequences()
      } else {
        await loadQueue()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadSequences = async () => {
    if (!isSupabaseMode || !supabase) {
      setSequences([])
      return
    }
    const { data, error: fetchError } = await supabase
      .from('generated_step_contents')
      .select('*')
      .eq('channel', 'email')
      .order('funnel_id', { ascending: true })
      .order('step_number', { ascending: true })

    if (fetchError) throw fetchError

    // funnel_id でグルーピング
    const grouped = {}
    for (const row of data || []) {
      const key = row.funnel_id
      if (!grouped[key]) {
        grouped[key] = {
          funnel_id: row.funnel_id,
          funnel_name: row.funnel_name,
          pattern_name: row.pattern_name,
          steps: [],
        }
      }
      grouped[key].steps.push(row)
    }
    setSequences(Object.values(grouped))
  }

  const loadQueue = async () => {
    if (!isSupabaseMode || !supabase) {
      setQueueItems([])
      return
    }
    const { data, error: fetchError } = await supabase
      .from('delivery_queue')
      .select('*')
      .order('scheduled_at', { ascending: false })
      .limit(100)

    if (fetchError) throw fetchError
    setQueueItems(data || [])
  }

  const handleDeleteSequence = async (funnelId, funnelName) => {
    if (!confirm(`シーケンス「${funnelName}」のAI生成コンテンツをすべて削除しますか？`)) return
    try {
      const { error: delError } = await supabase
        .from('generated_step_contents')
        .delete()
        .eq('funnel_id', funnelId)
        .eq('channel', 'email')
      if (delError) throw delError
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!isConnected) return <NotConnected setCurrentPage={setCurrentPage} />

  return (
    <div className="p-6 max-w-6xl mx-auto" data-page="sequences">
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* 案内 */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 text-sm text-emerald-900">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <div className="flex-1">
            <div className="font-bold mb-1">ステップメール（シーケンス）</div>
            フロービルダー（digicollab flow）で生成されたAIステップメールをここで一覧・管理できます。
            実際の配信予約はキャンペーン画面の「自動配信セットアップ」から実行し、Brevoの予約送信APIで指定日時に自動配信されます。
          </div>
        </div>
      </div>

      {/* タブ */}
      <div className="bg-white border border-slate-200 rounded-xl mb-4 flex items-center px-1">
        <TabButton active={tab === 'sequences'} onClick={() => setTab('sequences')}>
          <Workflow className="w-4 h-4" />
          シーケンス一覧
        </TabButton>
        <TabButton active={tab === 'queue'} onClick={() => setTab('queue')}>
          <Clock className="w-4 h-4" />
          配信キュー
        </TabButton>
        <div className="flex-1" />
        <button
          onClick={load}
          className="px-3 py-2 text-slate-500 hover:text-slate-700 text-xs font-bold flex items-center gap-1.5"
          title="再読み込み"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          更新
        </button>
      </div>

      {/* スタンドアロンモード警告 */}
      {!isSupabaseMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold mb-1">スタンドアロンモードです</div>
              シーケンス管理にはSupabase連携（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）が必要です。
              <br />
              単発キャンペーンはキャンペーン画面から作成できます。
            </div>
          </div>
        </div>
      )}

      {/* シーケンス一覧 */}
      {loading ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : tab === 'sequences' ? (
        sequences.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title="シーケンスがありません"
            description="フロービルダーからAIで生成すると、ここに自動でシーケンスが登録されます。"
          />
        ) : (
          <div className="space-y-3">
            {sequences.map((seq) => (
              <SequenceCard
                key={seq.funnel_id}
                sequence={seq}
                expanded={expandedFunnelId === seq.funnel_id}
                onToggle={() =>
                  setExpandedFunnelId(expandedFunnelId === seq.funnel_id ? null : seq.funnel_id)
                }
                onDelete={() => handleDeleteSequence(seq.funnel_id, seq.funnel_name)}
                canDelete={canUse(userTier, 'automation_toggle')}
              />
            ))}
          </div>
        )
      ) : queueItems.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="配信キューが空です"
          description="キャンペーン画面から自動配信を予約すると、ここに配信スケジュールが表示されます。"
        />
      ) : (
        <QueueList items={queueItems} />
      )}

      {/* 機能制限オーバーレイ（member ティア用） */}
      {isSupabaseMode && !canUse(userTier, 'schedule_manager') && (
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 relative">
          <LockedOverlay requiredTier="producer" feature="シーケンス管理" />
          <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Workflow className="w-4 h-4" />
            高度なシーケンス管理
          </div>
          <div className="text-xs text-slate-500 mt-1">
            プロデューサープラン以上で配信キューの編集・再送が可能
          </div>
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 transition-colors ${
        active
          ? 'text-emerald-700 border-b-2 border-emerald-600'
          : 'text-slate-500 hover:text-slate-700 border-b-2 border-transparent'
      }`}
    >
      {children}
    </button>
  )
}

function SequenceCard({ sequence, expanded, onToggle, onDelete, canDelete }) {
  const stepCount = sequence.steps.length
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-start gap-3 text-left hover:bg-slate-50"
      >
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
          <Workflow className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-sm font-bold text-slate-800 truncate">
              {sequence.funnel_name || sequence.funnel_id}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {stepCount} 通
            </span>
          </div>
          {sequence.pattern_name && (
            <div className="text-xs text-slate-500 mb-2">パターン: {sequence.pattern_name}</div>
          )}
          <div className="flex items-center gap-1 text-xs text-slate-600 flex-wrap">
            {sequence.steps.slice(0, 6).map((step, i) => (
              <div key={step.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-300">→</span>}
                <span className="px-2 py-0.5 rounded bg-slate-100 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {step.step_number}通目
                </span>
              </div>
            ))}
            {stepCount > 6 && <span className="text-slate-400">...</span>}
          </div>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-slate-400 shrink-0 mt-1 transition-transform ${
            expanded ? 'rotate-90' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
          {sequence.steps.map((step) => (
            <div key={step.id} className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                  {step.step_number}通目
                </span>
                {step.metadata?.delay_days !== undefined && (
                  <span className="text-xs text-slate-500">
                    配信: {step.metadata.delay_days === 0 ? '即時' : `${step.metadata.delay_days}日後`}
                  </span>
                )}
              </div>
              {step.subject && (
                <div className="text-sm font-bold text-slate-800 mb-2">{step.subject}</div>
              )}
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans max-h-32 overflow-y-auto">
                {step.body?.substring(0, 200)}
                {step.body?.length > 200 ? '...' : ''}
              </pre>
            </div>
          ))}
          {canDelete && (
            <button
              onClick={onDelete}
              className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              このシーケンスを削除
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const QUEUE_STATUS = {
  scheduled: { label: '予約済み', icon: Clock, cls: 'bg-blue-100 text-blue-700' },
  sent: { label: '配信済み', icon: CheckCircle2, cls: 'bg-green-100 text-green-700' },
  failed: { label: '失敗', icon: XCircle, cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'キャンセル', icon: XCircle, cls: 'bg-slate-100 text-slate-600' },
  sending: { label: '送信中', icon: Send, cls: 'bg-yellow-100 text-yellow-700' },
}

function QueueList({ items }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr>
            <th className="px-4 py-3 text-left font-bold">ステータス</th>
            <th className="px-4 py-3 text-left font-bold">シーケンス</th>
            <th className="px-4 py-3 text-left font-bold">ステップ</th>
            <th className="px-4 py-3 text-left font-bold">宛先</th>
            <th className="px-4 py-3 text-left font-bold">予定日時</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const s = QUEUE_STATUS[item.status] || QUEUE_STATUS.scheduled
            const Icon = s.icon
            return (
              <tr key={item.id} className="hover:bg-slate-50 text-sm">
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 ${s.cls}`}>
                    <Icon className="w-3 h-3" />
                    {s.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs truncate max-w-[180px]">
                  {item.funnel_name || item.funnel_id || '—'}
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">{item.step_number}通目</td>
                <td className="px-4 py-3 text-slate-800 text-xs truncate max-w-[200px]">
                  {item.recipient_email || '—'}
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {item.scheduled_at ? new Date(item.scheduled_at).toLocaleString('ja-JP') : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
      <Icon className="w-10 h-10 mx-auto mb-3 text-slate-300" />
      <div className="text-sm font-bold text-slate-600 mb-1">{title}</div>
      <div className="text-xs text-slate-400 max-w-md mx-auto px-4">{description}</div>
    </div>
  )
}
