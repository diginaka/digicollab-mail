// 自動配信パネル
// フロービルダー（?funnel_id=xxx）から開かれた時のみ表示。
// AI生成メール一式を読み込み、ワンクリックでBrevo予約配信をセットアップする。
//
// 旧 AIContentCopyBar（コピペ運用）を完全に置き換え、
// 「Brevo上でこのツールだけで完結」を実現する中核UI。
import { useEffect, useMemo, useState } from 'react'
import {
  Sparkles,
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Users,
  X,
  Calendar,
  Mail,
  Zap,
} from 'lucide-react'
import { useFlowContext } from '../hooks/useFlowContext'
import { useGeneratedContents } from '../hooks/useGeneratedContents'
import { useAutoDeliverySetup } from '../hooks/useAutoDeliverySetup'
import { useScheduledDelivery } from '../hooks/useScheduledDelivery'
import { listLists, getListContacts } from '../lib/brevo'

export default function AutoDeliveryPanel({ connection, isConnected }) {
  const { funnelId, isEmbedded } = useFlowContext()
  const { contents, funnelName, patternName, loading: contentsLoading } =
    useGeneratedContents(funnelId, 'email')
  const {
    items: queueItems,
    summary,
    hasActiveDelivery,
    refresh: refreshQueue,
  } = useScheduledDelivery(funnelId)

  const [expanded, setExpanded] = useState(true)
  const [lists, setLists] = useState([])
  const [selectedListId, setSelectedListId] = useState('')
  const [listLoading, setListLoading] = useState(false)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() + 5)
    return d.toISOString().slice(0, 16)
  })
  const [showConfirm, setShowConfirm] = useState(false)

  const sender = useMemo(
    () =>
      connection?.defaultSenderEmail
        ? { email: connection.defaultSenderEmail, name: connection.defaultSenderName || '' }
        : null,
    [connection]
  )

  const { setup, running, progress, error, result, reset } = useAutoDeliverySetup({
    apiKey: connection?.apiKey,
    sender,
  })

  // リスト取得
  useEffect(() => {
    if (!isEmbedded || !isConnected || !connection?.apiKey) return
    setListLoading(true)
    listLists(connection.apiKey)
      .then((resp) => {
        const list = resp?.lists || []
        setLists(list)
        if (list.length > 0 && !selectedListId) setSelectedListId(String(list[0].id))
      })
      .catch(() => setLists([]))
      .finally(() => setListLoading(false))
  }, [isEmbedded, isConnected, connection?.apiKey])

  // フロービルダーから開かれていない or コンテンツなし → 非表示
  if (!isEmbedded) return null
  if (!contentsLoading && contents.length === 0) return null

  const selectedList = lists.find((l) => String(l.id) === String(selectedListId))
  const canSetup =
    isConnected &&
    sender?.email &&
    selectedListId &&
    contents.length > 0 &&
    !running &&
    !hasActiveDelivery

  const handleStartSetup = async () => {
    if (!canSetup) return
    setShowConfirm(false)

    // Brevoからリストのコンタクトを取得
    let recipients = []
    try {
      const resp = await getListContacts(connection.apiKey, selectedListId, { limit: 500, offset: 0 })
      recipients = (resp?.contacts || [])
        .filter((c) => !c.emailBlacklisted && c.email)
        .map((c) => ({
          email: c.email,
          firstname: c.attributes?.FIRSTNAME || c.attributes?.firstname || '',
          lastname: c.attributes?.LASTNAME || c.attributes?.lastname || '',
        }))
    } catch (err) {
      alert(`コンタクト取得に失敗しました: ${err.message}`)
      return
    }

    if (recipients.length === 0) {
      alert('選択したリストに配信可能なコンタクトがいません')
      return
    }

    await setup({
      funnelId,
      funnelName,
      recipients,
      steps: contents,
      baseDate: new Date(startDate),
    })
    refreshQueue()
  }

  if (contentsLoading) {
    return (
      <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-sm text-emerald-700 flex items-center gap-2 shrink-0">
        <Loader2 className="w-4 h-4 animate-spin" />
        AI生成シーケンスを読み込み中...
      </div>
    )
  }

  return (
    <div
      className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200 shrink-0"
      data-auto-delivery-panel
    >
      {/* ヘッダー */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-emerald-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI自動配信
            </span>
            {funnelName && <span className="text-xs text-slate-600 truncate">{funnelName}</span>}
            {patternName && <span className="text-xs text-slate-400 truncate">/ {patternName}</span>}
            <span className="text-xs text-slate-500">· 全 {contents.length} 通</span>
          </div>
          <div className="text-xs text-slate-600 mt-0.5">
            ワンクリックでBrevoに全ステップを予約配信できます
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-slate-500 hover:text-slate-700 text-xs font-bold flex items-center gap-1"
          data-auto-delivery-toggle
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? '閉じる' : '開く'}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          {!isConnected ? (
            <Notice type="warning">
              Brevoに接続されていません。設定画面からAPIキーを登録してください。
            </Notice>
          ) : !sender?.email ? (
            <Notice type="warning">
              デフォルト送信者が未設定です。設定画面で認証済み送信者を選択してください。
            </Notice>
          ) : (
            <div className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
              {/* ステップ一覧 */}
              <div>
                <div className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  配信ステップ
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {contents.map((step) => {
                    const delay = step.metadata?.delay_days ?? step.step_number - 1
                    return (
                      <div
                        key={step.id}
                        className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2"
                      >
                        <span className="font-bold text-emerald-700 shrink-0 w-12">
                          {step.step_number}通目
                        </span>
                        <span className="text-slate-700 flex-1 truncate">
                          {step.subject || '(件名なし)'}
                        </span>
                        <span className="text-slate-400 shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {delay === 0 ? '即時' : `${delay}日後`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 配信先 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    配信先リスト
                  </label>
                  {listLoading ? (
                    <div className="py-2 text-xs text-slate-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> 読み込み中...
                    </div>
                  ) : lists.length === 0 ? (
                    <div className="text-xs text-amber-700">
                      リストがありません。リスト画面で新規作成してください。
                    </div>
                  ) : (
                    <select
                      value={selectedListId}
                      onChange={(e) => setSelectedListId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                      data-recipient-list-select
                    >
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({(l.totalSubscribers || 0).toLocaleString()}人)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    配信開始日時（1通目）
                  </label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                    data-start-date
                  />
                </div>
              </div>

              {/* 配信ボタン */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={!canSetup}
                  className="flex-1 px-4 py-2.5 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
                  style={{ backgroundColor: '#059669' }}
                  data-setup-auto-delivery
                >
                  {running ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      予約中... {progress.done}/{progress.total}
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      自動配信をセットアップ
                    </>
                  )}
                </button>
                {result && (
                  <button
                    onClick={reset}
                    className="px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50"
                  >
                    リセット
                  </button>
                )}
              </div>

              {/* 進捗プログレスバー */}
              {running && progress.total > 0 && (
                <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
              )}

              {/* 結果表示 */}
              {error && <Notice type="error">{error}</Notice>}
              {result && result.ok && (
                <Notice type="success">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />
                  {result.successCount.toLocaleString()}件の予約配信をセットアップしました。
                  指定日時にBrevoから自動送信されます。
                </Notice>
              )}
              {result && !result.ok && (
                <Notice type="warning">
                  成功 {result.successCount.toLocaleString()}件 / 失敗 {result.failedCount.toLocaleString()}件。
                  詳細はシーケンス画面の配信キューで確認できます。
                </Notice>
              )}

              {/* 既存配信サマリ */}
              {hasActiveDelivery && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-start gap-2">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    このシーケンスには既に予約配信があります: 全 {summary.total}件
                    {summary.scheduled ? ` / 予約中 ${summary.scheduled}件` : ''}
                    {summary.sent ? ` / 配信済 ${summary.sent}件` : ''}
                    {summary.failed ? ` / 失敗 ${summary.failed}件` : ''}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 確認モーダル */}
      {showConfirm && (
        <ConfirmModal
          listName={selectedList?.name || ''}
          listSize={selectedList?.totalSubscribers || 0}
          stepCount={contents.length}
          startDate={startDate}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleStartSetup}
        />
      )}
    </div>
  )
}

function Notice({ type = 'info', children }) {
  const cls =
    type === 'error'
      ? 'bg-red-50 border-red-200 text-red-700'
      : type === 'success'
      ? 'bg-green-50 border-green-200 text-green-800'
      : type === 'warning'
      ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-slate-50 border-slate-200 text-slate-700'
  return (
    <div className={`border rounded-lg p-3 text-xs flex items-start gap-2 ${cls}`}>
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1">{children}</div>
    </div>
  )
}

function ConfirmModal({ listName, listSize, stepCount, startDate, onCancel, onConfirm }) {
  const total = stepCount * listSize
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-600" />
            自動配信の確認
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <InfoRow label="配信先" value={`${listName}（${listSize.toLocaleString()}人）`} />
          <InfoRow label="ステップ数" value={`${stepCount}通`} />
          <InfoRow
            label="配信開始"
            value={new Date(startDate).toLocaleString('ja-JP')}
          />
          <InfoRow label="予約総数" value={`約 ${total.toLocaleString()} 通`} />
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            この操作によりBrevoに {total.toLocaleString()} 件の予約メールが登録されます。
            Brevoの送信クレジットを消費するため、実行前に件数をご確認ください。
          </div>
        </div>
        <div className="flex items-center gap-2 pt-4">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 text-white rounded-lg text-sm font-bold hover:opacity-90"
            style={{ backgroundColor: '#059669' }}
            data-confirm-setup
          >
            配信を予約する
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-slate-500 text-xs w-20 shrink-0">{label}</div>
      <div className="text-slate-800 font-bold flex-1">{value}</div>
    </div>
  )
}
