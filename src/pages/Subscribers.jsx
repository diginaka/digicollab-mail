import { useEffect, useState } from 'react'
import { Search, UserPlus, Loader2, Mail, Trash2, X, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { listSubscribers, createSubscriber, deleteSubscriber, listGroups } from '../lib/mailerlite'
import { canUse } from '../lib/tiers'
import { NotConnected } from './Dashboard'
import LockedOverlay from '../components/LockedOverlay'

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  unsubscribed: 'bg-slate-100 text-slate-600',
  bounced: 'bg-red-100 text-red-700',
  junk: 'bg-yellow-100 text-yellow-700',
  unconfirmed: 'bg-blue-100 text-blue-700',
}

const STATUS_LABELS = {
  active: 'アクティブ',
  unsubscribed: '配信停止',
  bounced: 'バウンス',
  junk: '迷惑メール',
  unconfirmed: '未確認',
}

export default function Subscribers({ isConnected, connection, userTier, setCurrentPage }) {
  const [loading, setLoading] = useState(false)
  const [subscribers, setSubscribers] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (isConnected) load()
  }, [isConnected, page, statusFilter])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const resp = await listSubscribers(connection.apiKey, {
        page,
        limit: 25,
        status: statusFilter || undefined,
      })
      setSubscribers(resp.data || [])
      setTotal(resp.total || resp.meta?.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = subscribers.filter(
    (s) => !search || (s.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id) => {
    if (!confirm('この登録者を削除しますか？この操作は取り消せません。')) return
    try {
      await deleteSubscriber(connection.apiKey, id)
      setToast('✓ 削除しました')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!isConnected) return <NotConnected setCurrentPage={setCurrentPage} />

  return (
    <div className="p-6 max-w-7xl mx-auto" data-page="subscribers">
      {toast && (
        <div className="mb-3 bg-green-50 border border-green-200 text-green-700 rounded-lg p-2 text-sm">{toast}</div>
      )}
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* 検索・フィルタ・追加 */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="メールアドレスで検索..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
            data-search
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
          data-status-filter
        >
          <option value="">すべてのステータス</option>
          <option value="active">アクティブ</option>
          <option value="unsubscribed">配信停止</option>
          <option value="bounced">バウンス</option>
          <option value="junk">迷惑メール</option>
        </select>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-white rounded-lg text-sm font-bold hover:opacity-90 flex items-center gap-1.5 justify-center"
          style={{ backgroundColor: '#059669' }}
          data-add-subscriber
        >
          <UserPlus className="w-4 h-4" />
          登録者を追加
        </button>
      </div>

      {/* テーブル */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            登録者がいません
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-bold">メールアドレス</th>
                <th className="px-4 py-3 text-left font-bold">名前</th>
                <th className="px-4 py-3 text-left font-bold">ステータス</th>
                <th className="px-4 py-3 text-left font-bold">登録日</th>
                <th className="px-4 py-3 text-right font-bold w-20">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 text-sm">
                  <td className="px-4 py-3 text-slate-800 font-medium">{s.email}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.fields?.name || s.fields?.last_name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[s.status] || 'bg-slate-100'}`}>
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {s.subscribed_at ? new Date(s.subscribed_at).toLocaleDateString('ja-JP') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-slate-400 hover:text-red-500 p-1"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ページネーション */}
      <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
        <div>全 {total.toLocaleString()} 件</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3">ページ {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={filtered.length < 25}
            className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 一括操作（creatorティア以上） */}
      {!canUse(userTier, 'bulk_subscriber_ops') && (
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 relative">
          <LockedOverlay requiredTier="creator" feature="一括操作" />
          <div className="text-sm font-bold text-slate-700">一括操作</div>
          <div className="text-xs text-slate-500 mt-1">複数の登録者をまとめてグループに追加・削除できます</div>
        </div>
      )}

      {/* 登録者追加モーダル */}
      {showAddModal && (
        <AddSubscriberModal
          connection={connection}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            setToast('✓ 登録しました')
            load()
          }}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
  )
}

function AddSubscriberModal({ connection, onClose, onSuccess, onError }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [groups, setGroups] = useState([])
  const [selectedGroups, setSelectedGroups] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listGroups(connection.apiKey)
      .then((resp) => setGroups(resp.data || []))
      .catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) return
    setSaving(true)
    try {
      await createSubscriber(connection.apiKey, {
        email,
        fields: name ? { name } : undefined,
        groups: selectedGroups.length ? selectedGroups : undefined,
      })
      onSuccess()
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800">登録者を追加</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">メールアドレス（必須）</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">名前</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
              placeholder="山田 太郎"
            />
          </div>
          {groups.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">グループに追加</label>
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm py-1">
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(g.id)}
                      onChange={(e) =>
                        setSelectedGroups((prev) =>
                          e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id)
                        )
                      }
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
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
              disabled={saving || !email}
              className="flex-1 px-4 py-2 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#059669' }}
            >
              {saving ? '登録中...' : '登録する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
