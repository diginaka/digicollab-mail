import { useEffect, useState } from 'react'
import { Users, Send, Mail, MousePointerClick, AlertCircle, ExternalLink, Plus, UserPlus, Loader2 } from 'lucide-react'
import { listContacts, listCampaigns, getAggregatedReport } from '../lib/brevo'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard({ isConnected, connection, setCurrentPage }) {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    totalContacts: 0,
    sentThisMonth: 0,
    avgOpenRate: 0,
    avgClickRate: 0,
    recentCampaigns: [],
    subscriberGrowth: [],
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isConnected) return
    load()
  }, [isConnected, connection.apiKey])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [contactsResp, sentResp, aggResp] = await Promise.all([
        listContacts(connection.apiKey, { limit: 1, offset: 0 }),
        listCampaigns(connection.apiKey, { type: 'classic', status: 'sent', limit: 10 }),
        getAggregatedReport(connection.apiKey, { days: 30 }).catch(() => null),
      ])

      const recent = sentResp?.campaigns || []
      const now = new Date()
      const thisMonth = now.getMonth()
      const sentThisMonth = recent.filter((c) => {
        const src = c.sentDate || c.scheduledAt || c.modifiedAt || c.createdAt
        if (!src) return false
        const d = new Date(src)
        return d.getMonth() === thisMonth && d.getFullYear() === now.getFullYear()
      }).length

      // 開封率・クリック率を aggregatedReport もしくはキャンペーン個別stats から算出
      let avgOpenRate = 0
      let avgClickRate = 0
      if (aggResp && aggResp.delivered) {
        avgOpenRate = (Number(aggResp.uniqueOpens || aggResp.opens || 0) / Number(aggResp.delivered)) * 100
        avgClickRate = (Number(aggResp.uniqueClicks || aggResp.clicks || 0) / Number(aggResp.delivered)) * 100
      } else {
        const rates = recent.map((c) => {
          const st = c.statistics?.globalStats || {}
          const deliv = Number(st.delivered || 0)
          return {
            open: deliv ? (Number(st.uniqueViews || 0) / deliv) * 100 : 0,
            click: deliv ? (Number(st.uniqueClicks || 0) / deliv) * 100 : 0,
          }
        })
        if (rates.length > 0) {
          avgOpenRate = rates.reduce((a, r) => a + r.open, 0) / rates.length
          avgClickRate = rates.reduce((a, r) => a + r.click, 0) / rates.length
        }
      }

      // 過去30日のダミー増減グラフ（実データはaggregatedReportに日次がないためイベントAPIが必要）
      const growth = Array.from({ length: 30 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (29 - i))
        return {
          date: `${d.getMonth() + 1}/${d.getDate()}`,
          新規登録: 0,
        }
      })

      setStats({
        totalContacts: contactsResp?.count ?? 0,
        sentThisMonth,
        avgOpenRate: Math.round(avgOpenRate * 100) / 100,
        avgClickRate: Math.round(avgClickRate * 100) / 100,
        recentCampaigns: recent.slice(0, 5),
        subscriberGrowth: growth,
      })
    } catch (err) {
      setError(err.message || 'データ取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (!isConnected) {
    return <NotConnected setCurrentPage={setCurrentPage} />
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" data-page="dashboard">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="総コンタクト数" value={stats.totalContacts.toLocaleString()} color="#059669" />
        <StatCard icon={Send} label="今月の配信数" value={stats.sentThisMonth} color="#2563eb" />
        <StatCard icon={Mail} label="平均開封率" value={`${stats.avgOpenRate}%`} color="#d97706" />
        <StatCard icon={MousePointerClick} label="平均クリック率" value={`${stats.avgClickRate}%`} color="#7c3aed" />
      </div>

      {/* クイックアクション */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <QuickAction icon={UserPlus} label="コンタクトを追加" onClick={() => setCurrentPage('subscribers')} />
        <QuickAction icon={Plus} label="新しいキャンペーン" onClick={() => setCurrentPage('campaigns')} />
        <a
          href="https://app.brevo.com"
          target="_blank"
          rel="noreferrer"
          className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:border-emerald-300 hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <ExternalLink className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-sm font-bold text-slate-800">Brevoを開く</div>
        </a>
      </div>

      {/* 登録者増減グラフ */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6" data-growth-chart>
        <h2 className="text-base font-bold text-slate-800 mb-4">過去30日の新規コンタクト推移</h2>
        <div className="h-64">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.subscriberGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="新規登録" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 直近キャンペーン */}
      <div className="bg-white border border-slate-200 rounded-xl p-5" data-recent-campaigns>
        <h2 className="text-base font-bold text-slate-800 mb-4">直近のキャンペーン</h2>
        {loading ? (
          <div className="py-12 flex justify-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : stats.recentCampaigns.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">まだ送信済みキャンペーンがありません</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {stats.recentCampaigns.map((c) => {
              const st = c.statistics?.globalStats || {}
              const deliv = Number(st.delivered || 0)
              const openRate = deliv ? (Number(st.uniqueViews || 0) / deliv) * 100 : 0
              const clickRate = deliv ? (Number(st.uniqueClicks || 0) / deliv) * 100 : 0
              return (
                <div key={c.id} className="py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{c.name || c.subject || '無題'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {c.sentDate ? new Date(c.sentDate).toLocaleString('ja-JP') : '送信日不明'}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs ml-4">
                    <div>
                      <div className="text-slate-400">開封</div>
                      <div className="font-bold text-emerald-600">{openRate.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-slate-400">クリック</div>
                      <div className="font-bold text-blue-600">{clickRate.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
    </div>
  )
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:border-emerald-300 hover:shadow-sm transition-all text-left"
    >
      <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-emerald-600" />
      </div>
      <div className="text-sm font-bold text-slate-800">{label}</div>
    </button>
  )
}

export function NotConnected({ setCurrentPage }) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center" data-not-connected>
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800 mb-2">Brevoに接続してください</h2>
        <p className="text-sm text-slate-600 mb-5">
          このツールを使うには、まずBrevoのAPIキーを設定する必要があります。
          <br />
          無料アカウントでOK（コンタクト無制限・300通/日）。設定画面から接続しましょう。
        </p>
        <button
          onClick={() => setCurrentPage('settings')}
          className="px-5 py-2.5 text-white rounded-lg text-sm font-bold hover:opacity-90"
          style={{ backgroundColor: '#059669' }}
        >
          設定画面へ
        </button>
      </div>
    </div>
  )
}
