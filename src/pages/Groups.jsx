import { useEffect, useState } from 'react'
import { FolderTree, Plus, Loader2, Users, AlertCircle, X, Trash2 } from 'lucide-react'
import { listLists, createList, deleteList, listFolders } from '../lib/brevo'
import { canUse } from '../lib/tiers'
import { NotConnected } from './Dashboard'
import LockedOverlay from '../components/LockedOverlay'

export default function Groups({ isConnected, connection, userTier, setCurrentPage }) {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    if (isConnected) load()
  }, [isConnected])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const resp = await listLists(connection.apiKey)
      setLists(resp?.lists || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (listId, name) => {
    if (!confirm(`リスト「${name}」を削除しますか？この操作は取り消せません。`)) return
    try {
      await deleteList(connection.apiKey, listId)
      setToast('✓ 削除しました')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!isConnected) return <NotConnected setCurrentPage={setCurrentPage} />

  return (
    <div className="p-6 max-w-6xl mx-auto" data-page="groups">
      {toast && (
        <div className="mb-3 bg-green-50 border border-green-200 text-green-700 rounded-lg p-2 text-sm">{toast}</div>
      )}
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* ヘッダー */}
      <div className="bg-white border border-slate-200 rounded-xl mb-4 flex items-center px-5 py-3">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-800">リスト（配信グループ）</h2>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => {
            if (!canUse(userTier, 'create_group')) return
            setShowCreateModal(true)
          }}
          disabled={!canUse(userTier, 'create_group')}
          className="px-4 py-2 text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          style={{ backgroundColor: '#059669' }}
          data-create-group
        >
          <Plus className="w-4 h-4" />
          新規リスト作成
        </button>
      </div>

      {/* リスト */}
      {loading ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {lists.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
              <FolderTree className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              リストがありません
            </div>
          ) : (
            lists.map((l) => (
              <div key={l.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-emerald-300 transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <FolderTree className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{l.name}</div>
                    <div className="text-xs text-slate-500">
                      {l.folderId != null ? `フォルダ: ${l.folderId}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(l.id, l.name)}
                    className="text-slate-400 hover:text-red-500 p-1"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span className="font-bold">{(l.totalSubscribers || 0).toLocaleString()}</span>
                    <span className="text-slate-400">人</span>
                  </div>
                  {l.totalBlacklisted != null && (
                    <div className="text-slate-400">
                      停止: <span className="font-bold">{l.totalBlacklisted.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateListModal
          connection={connection}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            setToast('✓ リストを作成しました')
            load()
          }}
          onError={setError}
        />
      )}
    </div>
  )
}

function CreateListModal({ connection, onClose, onSuccess, onError }) {
  const [name, setName] = useState('')
  const [folders, setFolders] = useState([])
  const [folderId, setFolderId] = useState(1)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listFolders(connection.apiKey)
      .then((resp) => {
        const list = resp?.folders || []
        setFolders(list)
        if (list.length > 0) setFolderId(list[0].id)
      })
      .catch(() => {})
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createList(connection.apiKey, name, Number(folderId))
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
          <h3 className="text-base font-bold text-slate-800">新規リストを作成</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">リスト名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="例：VIPメンバー"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          {folders.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">フォルダ</label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
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
