import { useEffect, useState } from 'react'
import { FolderTree, Plus, Loader2, Users, ExternalLink, AlertCircle, X } from 'lucide-react'
import { listGroups, createGroup, listSegments } from '../lib/mailerlite'
import { canUse } from '../lib/tiers'
import { NotConnected } from './Dashboard'
import LockedOverlay from '../components/LockedOverlay'

export default function Groups({ isConnected, connection, userTier, setCurrentPage }) {
  const [tab, setTab] = useState('groups')
  const [groups, setGroups] = useState([])
  const [segments, setSegments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    if (isConnected) load()
  }, [isConnected, tab])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      if (tab === 'groups') {
        const resp = await listGroups(connection.apiKey)
        setGroups(resp.data || [])
      } else {
        const resp = await listSegments(connection.apiKey)
        setSegments(resp.data || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isConnected) return <NotConnected setCurrentPage={setCurrentPage} />

  return (
    <div className="p-6 max-w-6xl mx-auto" data-page="groups">
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* タブ */}
      <div className="bg-white border border-slate-200 rounded-xl mb-4 flex items-center">
        <button
          onClick={() => setTab('groups')}
          className={`px-5 py-3 text-sm font-bold border-b-2 ${
            tab === 'groups' ? 'text-emerald-600 border-emerald-500' : 'text-slate-500 border-transparent'
          }`}
          data-tab-groups
        >
          グループ
        </button>
        <button
          onClick={() => setTab('segments')}
          className={`px-5 py-3 text-sm font-bold border-b-2 ${
            tab === 'segments' ? 'text-emerald-600 border-emerald-500' : 'text-slate-500 border-transparent'
          }`}
          data-tab-segments
        >
          セグメント
        </button>
        <div className="flex-1" />
        {tab === 'groups' && (
          <button
            onClick={() => {
              if (!canUse(userTier, 'create_group')) return
              setShowCreateModal(true)
            }}
            disabled={!canUse(userTier, 'create_group')}
            className="mr-3 px-4 py-2 text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            style={{ backgroundColor: '#059669' }}
            data-create-group
          >
            <Plus className="w-4 h-4" />
            新規グループ作成
          </button>
        )}
      </div>

      {/* リスト */}
      {loading ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : tab === 'groups' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
              <FolderTree className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              グループがありません
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-emerald-300 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <FolderTree className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{g.name}</div>
                    <div className="text-xs text-slate-500">
                      作成: {g.created_at ? new Date(g.created_at).toLocaleDateString('ja-JP') : '—'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Users className="w-3.5 h-3.5" />
                  <span className="font-bold">{(g.active_count || g.total || 0).toLocaleString()}</span>
                  <span className="text-slate-400">人の登録者</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-sm text-blue-900">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold mb-1">セグメントの作成について</div>
                セグメント（条件付きグループ）の作成・編集は、条件設定が複雑なため MailerLite 本家ダッシュボードで行ってください。このツールでは閲覧のみ可能です。
              </div>
            </div>
            <a
              href="https://app.mailerlite.com/subscribers/segments/create"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-sm font-bold text-blue-800 hover:text-blue-900"
            >
              MailerLiteでセグメントを作成 <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {segments.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
                セグメントがありません
              </div>
            ) : (
              segments.map((s) => (
                <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-sm font-bold text-slate-800 mb-2">{s.name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Users className="w-3.5 h-3.5" />
                    <span className="font-bold">{(s.total || 0).toLocaleString()}</span>
                    <span className="text-slate-400">人</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateGroupModal
          connection={connection}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            load()
          }}
          onError={setError}
        />
      )}
    </div>
  )
}

function CreateGroupModal({ connection, onClose, onSuccess, onError }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createGroup(connection.apiKey, name)
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
          <h3 className="text-base font-bold text-slate-800">新規グループを作成</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="グループ名（例：VIPメンバー）"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
          />
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
              disabled={saving || !name}
              className="flex-1 px-4 py-2 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#059669' }}
            >
              {saving ? '作成中...' : '作成する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
