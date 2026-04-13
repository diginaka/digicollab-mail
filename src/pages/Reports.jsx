import { useEffect, useState } from 'react'
import { BarChart3, Loader2, Download, AlertCircle, Mail, MousePointerClick, Send, UserMinus } from 'lucide-react'
import { listCampaigns, getCampaign } from '../lib/mailerlite'
import { canUse } from '../lib/tiers'
import { NotConnected } from './Dashboard'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Reports({ isConnected, connection, userTier, setCurrentPage }) {
  const [campaigns, setCampaigns] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isConnected) loadList()
  }, [isConnected])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
  }, [selectedId])

  const loadList = async () => {
    try {
      const resp = await listCampaigns(connection.apiKey, { limit: 50, status: 'sent' })
      setCampaigns(resp.data || [])
      if (resp.data && resp.data.length > 0) setSelectedId(resp.data[0].id)
    } catch (err) {
      setError(err.message)
    }
  }

  const loadDetail = async (id) => {
    setLoading(true)
    setError('')
    try {
      const resp = await getCampaign(connection.apiKey, id)
      setDetail(resp.data || resp)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = () => {
    if (!detail) return
    const rows = [
      ['項目', '値'],
      ['キャンペーン名', detail.name || ''],
      ['件名', detail.emails?.[0]?.subject || ''],
      ['送信日時', detail.finished_at || ''],
      ['送信数', detail.stats?.sent || 0],
      ['開封数', detail.stats?.opens_count || 0],
      ['開封率', `${Number(detail.stats?.open_rate?.float || detail.stats?.open_rate || 0).toFixed(2)}%`],
      ['クリック数', detail.stats?.clicks_count || 0],
      ['クリック率', `${Number(detail.stats?.click_rate?.float || detail.stats?.click_rate || 0).toFixed(2)}%`],
      ['解除数', detail.stats?.unsubscribes_count || 0],
    ]
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `campaign-${detail.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isConnected) return <NotConnected setCurrentPage={setCurrentPage} />

  const s = detail?.stats || {}
  const openRate = Number(s.open_rate?.float || s.open_rate || 0)
  const clickRate = Number(s.click_rate?.float || s.click_rate || 0)
  const unsubRate = Number(s.unsubscribe_rate?.float || s.unsubscribe_rate || 0)
  const sent = s.sent || 0

  const chartData = [
    { name: '送信', 件数: sent, color: '#94a3b8' },
    { name: '開封', 件数: s.opens_count || 0, color: '#059669' },
    { name: 'クリック', 件数: s.clicks_count || 0, color: '#2563eb' },
    { name: '解除', 件数: s.unsubscribes_count || 0, color: '#dc2626' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto" data-page="reports">
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* キャンペーン選択 */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex items-center gap-3">
        <label className="text-sm font-bold text-slate-600 shrink-0">キャンペーン:</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
          data-campaign-select
        >
          {campaigns.length === 0 && <option>送信済みキャンペーンがありません</option>}
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || c.subject || '無題'} — {c.finished_at ? new Date(c.finished_at).toLocaleDateString('ja-JP') : ''}
            </option>
          ))}
        </select>
        {canUse(userTier, 'csv_export') && detail && (
          <button
            onClick={exportCSV}
            className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 flex items-center gap-1.5"
            data-csv-export
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !detail ? (
        <div className="py-16 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          キャンペーンを選択してください
        </div>
      ) : (
        <>
          {/* レポートカード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <ReportCard icon={Send} label="送信数" value={sent.toLocaleString()} sub="" color="#94a3b8" />
            <ReportCard
              icon={Mail}
              label="開封数"
              value={(s.opens_count || 0).toLocaleString()}
              sub={`${openRate.toFixed(1)}%`}
              color="#059669"
            />
            <ReportCard
              icon={MousePointerClick}
              label="クリック数"
              value={(s.clicks_count || 0).toLocaleString()}
              sub={`${clickRate.toFixed(1)}%`}
              color="#2563eb"
            />
            <ReportCard
              icon={UserMinus}
              label="解除数"
              value={(s.unsubscribes_count || 0).toLocaleString()}
              sub={`${unsubRate.toFixed(1)}%`}
              color="#dc2626"
            />
          </div>

          {/* グラフ */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
            <h3 className="text-sm font-bold text-slate-800 mb-4">配信結果の比較</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                  <Bar dataKey="件数" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 詳細情報 */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3">キャンペーン詳細</h3>
            <dl className="text-sm space-y-2">
              <Row label="件名" value={detail.emails?.[0]?.subject || detail.subject || '—'} />
              <Row label="送信元" value={`${detail.emails?.[0]?.from_name || ''} <${detail.emails?.[0]?.from || ''}>`} />
              <Row label="送信完了" value={detail.finished_at ? new Date(detail.finished_at).toLocaleString('ja-JP') : '—'} />
              <Row label="配信先" value={`${detail.delivery_schedule || '—'}`} />
            </dl>
          </div>
        </>
      )}
    </div>
  )
}

function ReportCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <div className="text-xs text-slate-500">{label}</div>
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      {sub && (
        <div className="text-xs font-bold mt-1" style={{ color }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <dt className="text-slate-500 w-24 shrink-0 text-xs">{label}</dt>
      <dd className="text-slate-800 flex-1">{value}</dd>
    </div>
  )
}
