import { useEffect, useState } from 'react'
import { BarChart3, Loader2, Download, AlertCircle, Mail, MousePointerClick, Send, UserMinus } from 'lucide-react'
import { listCampaigns, getCampaign } from '../lib/brevo'
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
      const resp = await listCampaigns(connection.apiKey, { type: 'classic', status: 'sent', limit: 50 })
      const list = resp?.campaigns || []
      setCampaigns(list)
      if (list.length > 0) setSelectedId(list[0].id)
    } catch (err) {
      setError(err.message)
    }
  }

  const loadDetail = async (id) => {
    setLoading(true)
    setError('')
    try {
      const resp = await getCampaign(connection.apiKey, id)
      setDetail(resp)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isConnected) return <NotConnected setCurrentPage={setCurrentPage} />

  const gs = detail?.statistics?.globalStats || {}
  const sent = Number(gs.sent || 0)
  const delivered = Number(gs.delivered || 0)
  const uniqueOpens = Number(gs.uniqueViews || gs.viewed || 0)
  const uniqueClicks = Number(gs.uniqueClicks || gs.clickers || 0)
  const unsubscribed = Number(gs.unsubscribed || gs.unsubscriptions || 0)
  const hardBounces = Number(gs.hardBounces || 0)
  const softBounces = Number(gs.softBounces || 0)
  const complaints = Number(gs.complaints || 0)

  const openRate = delivered ? (uniqueOpens / delivered) * 100 : 0
  const clickRate = delivered ? (uniqueClicks / delivered) * 100 : 0
  const unsubRate = delivered ? (unsubscribed / delivered) * 100 : 0

  const chartData = [
    { name: '送信', 件数: sent },
    { name: '到達', 件数: delivered },
    { name: '開封', 件数: uniqueOpens },
    { name: 'クリック', 件数: uniqueClicks },
    { name: '解除', 件数: unsubscribed },
  ]

  const exportCSV = () => {
    if (!detail) return
    const sender = detail.sender || {}
    const rows = [
      ['項目', '値'],
      ['キャンペーン名', detail.name || ''],
      ['件名', detail.subject || ''],
      ['送信元', `${sender.name || ''} <${sender.email || ''}>`],
      ['送信日時', detail.sentDate || ''],
      ['送信数', sent],
      ['到達数', delivered],
      ['開封数', uniqueOpens],
      ['開封率', `${openRate.toFixed(2)}%`],
      ['クリック数', uniqueClicks],
      ['クリック率', `${clickRate.toFixed(2)}%`],
      ['解除数', unsubscribed],
      ['解除率', `${unsubRate.toFixed(2)}%`],
      ['ハードバウンス', hardBounces],
      ['ソフトバウンス', softBounces],
      ['苦情', complaints],
    ]
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `brevo-campaign-${detail.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
              {c.name || c.subject || '無題'} — {c.sentDate ? new Date(c.sentDate).toLocaleDateString('ja-JP') : ''}
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
            <ReportCard icon={Send} label="送信 / 到達" value={delivered.toLocaleString()} sub={`送信 ${sent.toLocaleString()}`} color="#94a3b8" />
            <ReportCard
              icon={Mail}
              label="開封数（ユニーク）"
              value={uniqueOpens.toLocaleString()}
              sub={`${openRate.toFixed(1)}%`}
              color="#059669"
            />
            <ReportCard
              icon={MousePointerClick}
              label="クリック（ユニーク）"
              value={uniqueClicks.toLocaleString()}
              sub={`${clickRate.toFixed(1)}%`}
              color="#2563eb"
            />
            <ReportCard
              icon={UserMinus}
              label="配信停止"
              value={unsubscribed.toLocaleString()}
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

          {/* バウンス・苦情 */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <MiniStat label="ハードバウンス" value={hardBounces.toLocaleString()} color="#dc2626" />
            <MiniStat label="ソフトバウンス" value={softBounces.toLocaleString()} color="#d97706" />
            <MiniStat label="苦情（スパム報告）" value={complaints.toLocaleString()} color="#7c3aed" />
          </div>

          {/* 詳細情報 */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3">キャンペーン詳細</h3>
            <dl className="text-sm space-y-2">
              <Row label="キャンペーン名" value={detail.name || '—'} />
              <Row label="件名" value={detail.subject || '—'} />
              <Row
                label="送信元"
                value={`${detail.sender?.name || ''} <${detail.sender?.email || ''}>`}
              />
              <Row
                label="返信先"
                value={detail.replyTo || '—'}
              />
              <Row
                label="送信完了"
                value={detail.sentDate ? new Date(detail.sentDate).toLocaleString('ja-JP') : '—'}
              />
              <Row
                label="対象リスト"
                value={
                  Array.isArray(detail.recipients?.lists) && detail.recipients.lists.length > 0
                    ? detail.recipients.lists.join(', ')
                    : '—'
                }
              />
              <Row label="ステータス" value={detail.status || '—'} />
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

function MiniStat({ label, value, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-xl font-bold" style={{ color }}>
        {value}
      </div>
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
