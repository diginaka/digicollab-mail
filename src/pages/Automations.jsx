import { useEffect, useState } from 'react'
import { Workflow, Loader2, AlertCircle, ExternalLink, Power, Clock, Mail } from 'lucide-react'
import { listAutomations } from '../lib/mailerlite'
import { canUse } from '../lib/tiers'
import { NotConnected } from './Dashboard'
import LockedOverlay from '../components/LockedOverlay'

export default function Automations({ isConnected, connection, userTier, setCurrentPage }) {
  const [automations, setAutomations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isConnected) load()
  }, [isConnected])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const resp = await listAutomations(connection.apiKey)
      setAutomations(resp.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isConnected) return <NotConnected setCurrentPage={setCurrentPage} />

  return (
    <div className="p-6 max-w-6xl mx-auto" data-page="automations">
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* ガイド */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-sm text-blue-900">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold mb-1">オートメーションの編集について</div>
            オートメーション（ステップメール）の作成・編集は MailerLite 本家ダッシュボードで行ってください。
            このツールでは既存オートメーションの一覧・ステータス確認・ON/OFF切り替えが可能です。
          </div>
        </div>
        <a
          href="https://app.mailerlite.com/automation/create"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-sm font-bold text-blue-800 hover:text-blue-900"
        >
          MailerLiteでオートメーションを作成 <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-400 text-sm">
          <Workflow className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          オートメーションがありません
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((a) => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <Workflow className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-sm font-bold text-slate-800 truncate">{a.name}</div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          a.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {a.enabled ? '稼働中' : '停止中'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mb-3">
                      トリガー: {a.trigger?.type || a.triggers?.[0]?.type || '—'}
                    </div>
                    {/* ステップ表示 */}
                    <div className="flex items-center gap-1 text-xs text-slate-600 flex-wrap">
                      {(a.steps || []).slice(0, 6).map((step, i) => (
                        <div key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-slate-300">→</span>}
                          <span className="px-2 py-0.5 rounded bg-slate-100 flex items-center gap-1">
                            {step.type === 'email' ? <Mail className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {step.type === 'email' ? 'メール' : step.type === 'delay' ? '待機' : step.type}
                          </span>
                        </div>
                      ))}
                      {(a.steps || []).length > 6 && <span className="text-slate-400">...</span>}
                    </div>
                    {/* 統計 */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-600">
                      <div>
                        完了: <span className="font-bold">{(a.stats?.completed_subscribers_count || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        実行中: <span className="font-bold">{(a.stats?.subscribers_in_queue_count || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://app.mailerlite.com/automation/${a.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    編集 <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!canUse(userTier, 'automation_toggle') && automations.length > 0 && (
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 relative">
          <LockedOverlay requiredTier="producer" feature="オートメーションON/OFF切替" />
          <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Power className="w-4 h-4" />
            オートメーションON/OFF切替
          </div>
          <div className="text-xs text-slate-500 mt-1">プロデューサープラン以上でボタン操作が可能</div>
        </div>
      )}
    </div>
  )
}
