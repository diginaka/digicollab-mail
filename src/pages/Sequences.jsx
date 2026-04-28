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
  Zap,
  Pencil,
  X as XIcon,
} from 'lucide-react'
import { supabase, isSupabaseMode } from '../lib/supabase'
import { canUse } from '../lib/tiers'
import { NotConnected } from './Dashboard'
import LockedOverlay from '../components/LockedOverlay'
import { useFlowContext } from '../hooks/useFlowContext'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useBusinessProfile } from '../hooks/useBusinessProfile'
import { useSequenceStatus } from '../hooks/useSequenceStatus'
import SequenceStatusBadge from '../components/sequences/SequenceStatusBadge'
import ConfirmActivationModal from '../components/sequences/ConfirmActivationModal'
import TestSendModal from '../components/sequences/TestSendModal'
// バグ #4 (2026-04-28): 各通の件名/本文編集モーダル
import EditStepModal from '../components/sequences/EditStepModal'

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

  // ─ 自動配信確定 / テスト送信 関連 ─
  const { funnelId: embeddedFunnelId, isEmbedded } = useFlowContext()
  const { email: currentUserEmail } = useCurrentUser()
  const { profileId: businessProfileId, loading: profileLoading } =
    useBusinessProfile(currentUserEmail)
  const {
    status: embeddedStatus,
    activeSteps: embeddedActiveSteps,
    refresh: refreshEmbeddedStatus,
  } = useSequenceStatus(isEmbedded ? embeddedFunnelId : null)

  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [testSendTarget, setTestSendTarget] = useState(null) // { funnelId, stepNumber, subject }
  // バグ #4: 各通の編集対象 step (generated_step_contents row) と funnelId
  const [editTarget, setEditTarget] = useState(null) // { step, funnelId }

  useEffect(() => {
    if (isConnected) load()
  }, [isConnected, tab])

  // トースト自動消去
  useEffect(() => {
    if (!toast && !toastError) return
    const t = setTimeout(() => {
      setToast('')
      setToastError('')
    }, 4000)
    return () => clearTimeout(t)
  }, [toast, toastError])

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

  // 埋め込み時に表示中の funnel に対応する generated_step_contents を取り出し
  const embeddedSequence = isEmbedded
    ? sequences.find((s) => s.funnel_id === embeddedFunnelId) || null
    : null

  const handleConfirmSuccess = ({ upsertedCount }) => {
    setToast(`✓ 自動配信を有効化しました（${upsertedCount}通）`)
    setToastError('')
    refreshEmbeddedStatus()
  }
  const handleConfirmError = (msg) => {
    setToast('')
    setToastError(`自動配信の確定に失敗しました: ${msg}`)
  }
  const handleTestSendSuccess = ({ recipient, stepNumber }) => {
    setToast(`✓ ${recipient} にテスト送信しました（Step ${stepNumber}）`)
    setToastError('')
  }
  const handleTestSendError = (msg) => {
    setToast('')
    setToastError(msg)
  }
  // バグ #4: 編集保存後はリスト再読込みして最新値を反映
  const handleEditSaved = ({ stepNumber }) => {
    setToast(`✓ ${stepNumber}通目を保存しました`)
    setToastError('')
    load()
  }
  const handleEditError = (msg) => {
    setToast('')
    setToastError(`編集の保存に失敗しました: ${msg}`)
  }

  if (!isConnected) return <NotConnected setCurrentPage={setCurrentPage} />

  return (
    <div className="p-6 max-w-6xl mx-auto" data-page="sequences">
      {/* トースト */}
      {toast && (
        <div
          className="mb-3 bg-green-50 border border-green-200 text-green-700 rounded-lg p-2 text-sm flex items-center justify-between gap-2"
          data-toast="success"
        >
          <span>{toast}</span>
          <button
            onClick={() => setToast('')}
            className="text-green-600/60 hover:text-green-700"
            aria-label="閉じる"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {toastError && (
        <div
          className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-sm flex items-center justify-between gap-2"
          data-toast="error"
        >
          <span>{toastError}</span>
          <button
            onClick={() => setToastError('')}
            className="text-red-600/60 hover:text-red-700"
            aria-label="閉じる"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* 埋め込み時の主要アクション帯（フロービルダー本体から開かれた時のみ） */}
      {isEmbedded && isSupabaseMode && (
        <div
          className="mb-4 bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3"
          data-embed-actions
        >
          <SequenceStatusBadge status={embeddedStatus} size="lg" />
          <div className="flex-1 min-w-[200px] text-xs text-slate-500">
            {embeddedStatus === 'active' &&
              `自動配信中（${embeddedActiveSteps.size}通登録済み）— 新規購読者に自動でメールが届きます`}
            {embeddedStatus === 'draft' &&
              '生成済みのメールを「自動配信として確定」すると、新規購読者へ自動配信が開始されます'}
            {embeddedStatus === 'error' &&
              '直近の配信でエラーが発生しています。配信ログを確認してください'}
            {embeddedStatus === 'empty' &&
              'まだメールが生成されていません。フロービルダーでAI生成を実行してください'}
          </div>
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={
              embeddedStatus === 'empty' ||
              !embeddedSequence ||
              !businessProfileId ||
              profileLoading
            }
            className="px-4 py-2 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
            style={{ backgroundColor: '#059669' }}
            data-confirm-activation-trigger
            title={
              !businessProfileId
                ? 'ビジネスプロフィールを取得できませんでした'
                : embeddedStatus === 'empty'
                ? 'まずフロービルダーでメールを生成してください'
                : '公開LP からオプトインした人に、このシーケンスを自動配信します'
            }
          >
            <Zap className="w-4 h-4" />
            {/* バグ #1 関連 (2026-04-28): 達也さん向けに「何が起きるか」明示。
                旧: 「自動配信として確定」/「自動配信を更新する」
                新: 「自動配信を有効化する」/「自動配信の設定を更新」 */}
            {embeddedStatus === 'active' || embeddedStatus === 'error'
              ? '自動配信の設定を更新'
              : '自動配信を有効化する'}
          </button>
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
                onTestSend={(stepNumber, subject) =>
                  setTestSendTarget({
                    funnelId: seq.funnel_id,
                    stepNumber,
                    subject,
                  })
                }
                onEdit={(step) =>
                  setEditTarget({
                    step,
                    funnelId: seq.funnel_id,
                  })
                }
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

      {/* 自動配信確定モーダル */}
      {showConfirmModal && embeddedSequence && (
        <ConfirmActivationModal
          funnelId={embeddedFunnelId}
          businessProfileId={businessProfileId}
          contents={embeddedSequence.steps}
          activeSteps={embeddedActiveSteps}
          onClose={() => setShowConfirmModal(false)}
          onSuccess={handleConfirmSuccess}
          onError={handleConfirmError}
        />
      )}

      {/* テスト送信モーダル */}
      {testSendTarget && (
        <TestSendModal
          funnelId={testSendTarget.funnelId}
          businessProfileId={businessProfileId}
          stepNumber={testSendTarget.stepNumber}
          defaultEmail={currentUserEmail || ''}
          subjectPreview={testSendTarget.subject}
          onClose={() => setTestSendTarget(null)}
          onSuccess={handleTestSendSuccess}
          onError={handleTestSendError}
        />
      )}

      {/* バグ #4: メール編集モーダル */}
      {editTarget && (
        <EditStepModal
          step={editTarget.step}
          funnelId={editTarget.funnelId}
          onClose={() => setEditTarget(null)}
          onSaved={handleEditSaved}
          onError={handleEditError}
        />
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

function SequenceCard({ sequence, expanded, onToggle, onDelete, canDelete, onTestSend, onEdit }) {
  const stepCount = sequence.steps.length
  // 一覧モード時は SequenceCard 自身が status を取りに行く（埋め込み時の主要アクション帯と二段構え）
  const { status, activeSteps } = useSequenceStatus(sequence.funnel_id)
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
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="text-sm font-bold text-slate-800 truncate">
              {sequence.funnel_name || sequence.funnel_id}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {stepCount} 通
            </span>
            <SequenceStatusBadge status={status} size="sm" />
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
          {sequence.steps.map((step) => {
            const isActive = activeSteps?.has(step.step_number)
            return (
              <div key={step.id} className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                    {step.step_number}通目
                  </span>
                  {step.metadata?.delay_days !== undefined && (
                    <span className="text-xs text-slate-500">
                      配信: {step.metadata.delay_days === 0 ? '即時' : `${step.metadata.delay_days}日後`}
                    </span>
                  )}
                  <div className="flex-1" />
                  {isActive && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center gap-1"
                      data-step-active
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      自動配信中
                    </span>
                  )}
                  {/* バグ #4: 編集ボタン (常時押下可) */}
                  {onEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(step)
                      }}
                      title="このメールの件名・本文を編集します"
                      className="text-[11px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 inline-flex items-center gap-1"
                      data-edit-step-trigger={step.step_number}
                    >
                      <Pencil className="w-3 h-3" />
                      編集
                    </button>
                  )}
                  {onTestSend && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!isActive) return
                        onTestSend(step.step_number, step.subject)
                      }}
                      disabled={!isActive}
                      title={
                        isActive
                          ? 'この step をテスト送信します'
                          : '先に「自動配信として確定」を実行してください'
                      }
                      className="text-[11px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                      data-test-send-trigger={step.step_number}
                    >
                      <Send className="w-3 h-3" />
                      テスト送信
                    </button>
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
            )
          })}
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
