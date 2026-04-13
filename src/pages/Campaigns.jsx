import { useEffect, useState } from 'react'
import { Send, Plus, Loader2, AlertCircle, ExternalLink, X, Calendar, Zap } from 'lucide-react'
import { listCampaigns, createCampaign, scheduleCampaign, listGroups } from '../lib/mailerlite'
import { canUse } from '../lib/tiers'
import { NotConnected } from './Dashboard'
import LockedOverlay from '../components/LockedOverlay'

const STATUS_LABELS = {
  draft: '下書き',
  ready: 'スケジュール済',
  sent: '送信済み',
  sending: '送信中',
  queued: '予約中',
}
const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-600',
  ready: 'bg-blue-100 text-blue-700',
  sent: 'bg-green-100 text-green-700',
  sending: 'bg-yellow-100 text-yellow-700',
  queued: 'bg-purple-100 text-purple-700',
}

export default function Campaigns({ isConnected, connection, userTier, setCurrentPage }) {
  const [tab, setTab] = useState('draft')
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const canCreate = canUse(userTier, 'create_campaign')

  useEffect(() => {
    if (isConnected) load()
  }, [isConnected, tab])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const statusMap = { draft: 'draft', ready: 'ready', sent: 'sent' }
      const resp = await listCampaigns(connection.apiKey, { limit: 25, status: statusMap[tab] })
      setCampaigns(resp.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isConnected) return <NotConnected setCurrentPage={setCurrentPage} />

  return (
    <div className="p-6 max-w-6xl mx-auto" data-page="campaigns">
      {toast && (
        <div className="mb-3 bg-green-50 border border-green-200 text-green-700 rounded-lg p-2 text-sm">{toast}</div>
      )}
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* タブ + 新規作成 */}
      <div className="bg-white border border-slate-200 rounded-xl mb-4 flex items-center">
        {[
          { id: 'draft', label: '下書き' },
          { id: 'ready', label: 'スケジュール済' },
          { id: 'sent', label: '送信済み' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-bold border-b-2 ${
              tab === t.id ? 'text-emerald-600 border-emerald-500' : 'text-slate-500 border-transparent'
            }`}
            data-tab={t.id}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => canCreate && setShowCreateModal(true)}
          disabled={!canCreate}
          className="mr-3 px-4 py-2 text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          style={{ backgroundColor: '#059669' }}
          data-create-campaign
        >
          <Plus className="w-4 h-4" />
          新規キャンペーン
        </button>
      </div>

      {/* ガイドメッセージ */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold mb-1">メール本文のデザインについて</div>
            このツールではキャンペーンの作成・スケジュール・分析ができます。
            メール本文のデザイン（HTML編集）はMailerLiteのドラッグ＆ドロップエディタで行ってください。
            下書き作成後、MailerLite側で本文を編集してからこのツールでスケジュール設定する流れが効率的です。
          </div>
        </div>
      </div>

      {/* キャンペーン一覧 */}
      {loading ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {campaigns.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <Send className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              {tab === 'draft' ? '下書きキャンペーンがありません' : tab === 'sent' ? '送信済みキャンペーンがありません' : 'スケジュール済キャンペーンがありません'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">件名 / 名前</th>
                  <th className="px-4 py-3 text-left font-bold">ステータス</th>
                  <th className="px-4 py-3 text-left font-bold">送信日時</th>
                  {tab === 'sent' && (
                    <>
                      <th className="px-4 py-3 text-right font-bold">開封率</th>
                      <th className="px-4 py-3 text-right font-bold">クリック率</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-right font-bold w-32">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800 truncate max-w-xs">{c.name || c.subject || '無題'}</div>
                      {c.subject && c.name !== c.subject && (
                        <div className="text-xs text-slate-500 truncate max-w-xs">{c.subject}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] || 'bg-slate-100'}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {c.scheduled_for
                        ? new Date(c.scheduled_for).toLocaleString('ja-JP')
                        : c.finished_at
                        ? new Date(c.finished_at).toLocaleString('ja-JP')
                        : '—'}
                    </td>
                    {tab === 'sent' && (
                      <>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">
                          {Number(c.stats?.open_rate?.float || c.stats?.open_rate || 0).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600">
                          {Number(c.stats?.click_rate?.float || c.stats?.click_rate || 0).toFixed(1)}%
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`https://app.mailerlite.com/campaigns/${c.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                      >
                        MailerLiteで開く <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!canCreate && (
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 relative">
          <LockedOverlay requiredTier="creator" feature="キャンペーン作成" />
          <div className="text-sm font-bold text-slate-700">キャンペーン作成・スケジュール</div>
        </div>
      )}

      {showCreateModal && (
        <CreateCampaignModal
          connection={connection}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(msg) => {
            setShowCreateModal(false)
            setToast(msg)
            load()
          }}
          onError={setError}
        />
      )}
    </div>
  )
}

function CreateCampaignModal({ connection, onClose, onSuccess, onError }) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [groups, setGroups] = useState([])
  const [form, setForm] = useState({
    name: '',
    subject: '',
    from_name: '',
    from: '',
    groups: [],
    type: 'regular',
  })
  const [createdCampaign, setCreatedCampaign] = useState(null)
  const [deliveryType, setDeliveryType] = useState('instant')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')

  useEffect(() => {
    listGroups(connection.apiKey)
      .then((resp) => setGroups(resp.data || []))
      .catch(() => {})
  }, [])

  const submitCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const resp = await createCampaign(connection.apiKey, {
        name: form.name,
        type: form.type,
        emails: [
          {
            subject: form.subject,
            from_name: form.from_name,
            from: form.from,
          },
        ],
        groups: form.groups,
      })
      setCreatedCampaign(resp.data || resp)
      setStep(2)
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const submitSchedule = async () => {
    if (!createdCampaign) return
    setSaving(true)
    try {
      if (deliveryType === 'instant') {
        await scheduleCampaign(connection.apiKey, createdCampaign.id, { delivery: 'instant' })
        onSuccess('✓ 送信キューに追加しました')
      } else {
        const [h, m] = scheduleTime.split(':')
        await scheduleCampaign(connection.apiKey, createdCampaign.id, {
          delivery: 'scheduled',
          schedule: { date: scheduleDate, hours: h, minutes: m },
        })
        onSuccess('✓ スケジュールを登録しました')
      }
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800">
            {step === 1 ? '新規キャンペーン作成（1/2）' : '配信タイミングを選択（2/2）'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 1 ? (
          <form onSubmit={submitCreate} className="space-y-3">
            <Field label="キャンペーン名（内部管理用）">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="input"
                placeholder="例：4月号メルマガ"
              />
            </Field>
            <Field label="件名（Subject Line）">
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
                className="input"
                placeholder="例：【今月のお知らせ】春のキャンペーン開催中🌸"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="送信元名前">
                <input
                  type="text"
                  value={form.from_name}
                  onChange={(e) => setForm({ ...form, from_name: e.target.value })}
                  required
                  className="input"
                  placeholder="デジコラボ"
                />
              </Field>
              <Field label="送信元メール">
                <input
                  type="email"
                  value={form.from}
                  onChange={(e) => setForm({ ...form, from: e.target.value })}
                  required
                  className="input"
                  placeholder="info@example.com"
                />
              </Field>
            </div>
            {groups.length > 0 && (
              <Field label="送信先グループ">
                <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                  {groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm py-1">
                      <input
                        type="checkbox"
                        checked={form.groups.includes(g.id)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            groups: e.target.checked
                              ? [...form.groups, g.id]
                              : form.groups.filter((id) => id !== g.id),
                          })
                        }
                      />
                      {g.name} <span className="text-slate-400 text-xs">({g.active_count || 0}人)</span>
                    </label>
                  ))}
                </div>
              </Field>
            )}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#059669' }}
              >
                {saving ? '作成中...' : '下書きを作成'}
              </button>
            </div>
            <style>{`.input{width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none}.input:focus{border-color:#059669}`}</style>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              ✓ 下書きを作成しました。次に配信タイミングを選びます。
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
              💡 配信前にMailerLiteでメール本文をデザインすることをおすすめします。
              <a
                href={createdCampaign ? `https://app.mailerlite.com/campaigns/${createdCampaign.id}` : '#'}
                target="_blank"
                rel="noreferrer"
                className="ml-1 font-bold underline"
              >
                本文を編集する ↗
              </a>
            </div>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:border-emerald-300">
                <input
                  type="radio"
                  name="delivery"
                  value="instant"
                  checked={deliveryType === 'instant'}
                  onChange={(e) => setDeliveryType(e.target.value)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-1">
                    <Zap className="w-4 h-4" />
                    今すぐ送信
                  </div>
                  <div className="text-xs text-slate-500">すぐに全登録者へ配信します</div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:border-emerald-300">
                <input
                  type="radio"
                  name="delivery"
                  value="scheduled"
                  checked={deliveryType === 'scheduled'}
                  onChange={(e) => setDeliveryType(e.target.value)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    日時指定
                  </div>
                  <div className="text-xs text-slate-500">指定した日時に自動配信</div>
                  {deliveryType === 'scheduled' && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs"
                      />
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="px-2 py-1 border border-slate-200 rounded text-xs"
                      />
                    </div>
                  )}
                </div>
              </label>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                後で
              </button>
              <button
                onClick={submitSchedule}
                disabled={saving || (deliveryType === 'scheduled' && !scheduleDate)}
                className="flex-1 px-4 py-2 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#059669' }}
              >
                {saving ? '処理中...' : deliveryType === 'instant' ? '送信する' : 'スケジュール'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
