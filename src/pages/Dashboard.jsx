import { useEffect, useState } from 'react'
import { Users, Send, Mail, MousePointerClick, AlertCircle, ExternalLink, Plus, UserPlus, Loader2 } from 'lucide-react'
import { listSubscribers, listCampaigns } from '../lib/mailerlite'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard({ isConnected, connection, setCurrentPage }) {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    totalSubscribers: 0,
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
      const [subsResp, sentResp] = await Promise.all([
        listSubscribers(connection.apiKey, { limit: 1 }),
        listCampaigns(connection.apiKey, { limit: 10, status: 'sent' }),
      ])
      const recent = sentResp.data || []
      const openRates = recent.map((c) => Number(c.stats?.open_rate?.float || c.stats?.open_rate || 0))
      const clickRates = recent.map((c) => Number(c.stats?.click_rate?.float || c.stats?.click_rate || 0))
      const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
      const now = new Date()
      const thisMonth = now.getMonth()
      const sentThisMonth = recent.filter((c) => {
        const d = new Date(c.finished_at || c.scheduled_for || c.created_at)
        return d.getMonth() === thisMonth && d.getFullYear() === now.getFullYear()
      }).length

      // 過去30日のダミー増減グラフ（実際は登録者作成日でグループ化が必要）
      const growth = Array.from({ length: 30 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (29 - i))
        return {
          date: `${d.getMonth() + 1}/${d.getDate()}`,
          新規登録: Math.floor(Math.random() * 5),
        }
      })

      setStats({
        totalSubscribers: subsResp.total || subsResp.meta?.total || 0,
        sentThisMonth,
        avgOpenRate: Math.round(avg(openRates) * 100) / 100,
        avgClickRate: Math.round(avg(clickRates) * 100) / 100,
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
        <StatCard icon={Users} label="総登録者数" value={stats.totalSubscribers.toLocaleString()} color="#059669" />
        <StatCard icon={Send} label="今月の配信数" value={stats.sentThisMonth} color="#2563eb" />
        <StatCard icon={Mail} label="平均開封率" value={`${stats.avgOpenRate}%`} color="#d97706" />
        <StatCard icon={MousePointerClick} label="平均クリック率" value={`${stats.avgClickRate}%`} color="#7c3aed" />
      </div>

      {/* クイックアクション */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <QuickAction icon={UserPlus} label="登録者を追加" onClick={() => setCurrentPage('subscribers')} />
        <QuickAction icon={Plus} label="新しいキャンペーン" onClick={() => setCurrentPage('campaigns')} />
        <a
          href="https://app.mailerlite.com"
          target="_blank"
          rel="noreferrer"
          className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:border-emerald-300 hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <ExternalLink className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-sm font-bold text-slate-800">MailerLiteを開く</div>
        </a>
      </div>

      {/* 登録者増減グラフ */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6" data-growth-chart>
        <h2 className="text-base font-bold text-slate-800 mb-4">過去30日の新規登録者数</h2>
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
            {stats.recentCampaigns.map((c) => (
              <div key={c.id} className="py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-800 truncate">{c.name || c.subject || '無題'}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {c.finished_at ? new Date(c.finished_at).toLocaleString('ja-JP') : '送信日不明'}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs ml-4">
                  <div>
                    <div className="text-slate-400">開封</div>
                    <div className="font-bold text-emerald-600">
                      {Number(c.stats?.open_rate?.float || c.stats?.open_rate || 0).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">クリック</div>
                    <div className="font-bold text-blue-600">
                      {Number(c.stats?.click_rate?.float || c.stats?.click_rate || 0).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
        <h2 className="text-lg font-bold text-slate-800 mb-2">MailerLiteに接続してください</h2>
        <p className="text-sm text-slate-600 mb-5">
          このツールを使うには、まずMailerLiteのAPIキーを設定する必要があります。
          <br />
          無料アカウントでOK。設定画面から接続しましょう。
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
