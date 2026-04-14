import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, FolderTree, Send, BarChart3, Workflow,
  Settings as SettingsIcon, ChevronLeft, ChevronRight, Mail, CheckCircle2, Circle,
} from 'lucide-react'
import { localStore, isSupabaseMode } from './lib/supabase'
import AutoDeliveryPanel from './components/AutoDeliveryPanel'
import Dashboard from './pages/Dashboard'
import Subscribers from './pages/Subscribers'
import Groups from './pages/Groups'
import Campaigns from './pages/Campaigns'
import Reports from './pages/Reports'
import Sequences from './pages/Sequences'
import Settings from './pages/Settings'

const NAV = [
  { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { id: 'subscribers', label: 'コンタクト管理', icon: Users },
  { id: 'groups', label: 'リスト', icon: FolderTree },
  { id: 'campaigns', label: 'キャンペーン', icon: Send },
  { id: 'reports', label: '配信レポート', icon: BarChart3 },
  { id: 'sequences', label: 'シーケンス', icon: Workflow },
  { id: 'settings', label: '設定', icon: SettingsIcon },
]

const DEFAULT_CONNECTION = {
  apiKey: '',
  accountName: '',
  email: '',
  planName: '',
  credits: 0,
  creditsType: '',
  isConnected: false,
  lastVerifiedAt: null,
  defaultSenderEmail: '',
  defaultSenderName: '',
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [connection, setConnection] = useState(() => ({
    ...DEFAULT_CONNECTION,
    ...localStore.get('connection', {}),
  }))
  // ティア: Supabase連携モード時は member から（本番は認証で取得）
  // スタンドアロンモード時は partner（全機能アンロック）
  const [userTier, setUserTier] = useState(() =>
    isSupabaseMode ? (localStore.get('userTier', 'member')) : 'partner'
  )

  useEffect(() => {
    localStore.set('connection', connection)
  }, [connection])

  useEffect(() => {
    localStore.set('userTier', userTier)
  }, [userTier])

  const isConnected = Boolean(connection.apiKey && connection.isConnected)
  const mode = isSupabaseMode ? 'supabase' : 'standalone'

  const pageProps = {
    isConnected,
    connection,
    userTier,
    setCurrentPage,
  }

  const pages = {
    dashboard: <Dashboard {...pageProps} />,
    subscribers: <Subscribers {...pageProps} />,
    groups: <Groups {...pageProps} />,
    campaigns: <Campaigns {...pageProps} />,
    reports: <Reports {...pageProps} />,
    sequences: <Sequences {...pageProps} />,
    settings: (
      <Settings
        connection={connection}
        setConnection={setConnection}
        userTier={userTier}
        setUserTier={setUserTier}
      />
    ),
  }

  return (
    <div className="app-container">
      {/* サイドバー */}
      <aside
        className={`${collapsed ? 'w-16' : 'w-60'} transition-all duration-200 flex flex-col`}
        style={{ backgroundColor: '#0f2e24' }}
      >
        <div className="h-16 flex items-center px-4 border-b border-white/10">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#059669' }}
          >
            <Mail className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="ml-3 min-w-0">
              <div className="text-white font-bold text-sm truncate">デジコラボ メール</div>
              <div className="text-white/50 text-[10px]">Brevo連携</div>
            </div>
          )}
        </div>

        <nav className="flex-1 py-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center px-4 py-2.5 text-sm transition-colors ${
                  active ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                style={
                  active
                    ? { backgroundColor: 'rgba(5, 150, 105, 0.2)', borderLeft: '3px solid #059669' }
                    : { borderLeft: '3px solid transparent' }
                }
                data-nav={item.id}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="ml-3 truncate">{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-12 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 border-t border-white/10"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </aside>

      {/* メインコンテンツ */}
      <div className="main-content">
        {/* ヘッダー */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              {NAV.find((n) => n.id === currentPage)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* モードバッジ */}
            <span
              className={`text-xs px-2.5 py-1 rounded-full border ${
                mode === 'supabase'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {mode === 'supabase' ? 'Supabase接続' : 'スタンドアロン'}
            </span>
            {/* プランバッジ（Supabase連携時のみ） */}
            {mode === 'supabase' && (
              <span className="text-xs px-2.5 py-1 rounded-full border bg-purple-50 text-purple-700 border-purple-200">
                {userTier}
              </span>
            )}
            {/* 接続ステータス */}
            <span
              className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                isConnected
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
              data-connection-status
            >
              {isConnected ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <Circle className="w-3 h-3" />
              )}
              {isConnected
                ? `Brevo接続済 ${connection.accountName ? `(${connection.accountName})` : ''}`
                : 'Brevo未接続'}
            </span>
          </div>
        </header>

        {/* 自動配信パネル（フロービルダーから開かれた時のみ表示） */}
        <AutoDeliveryPanel connection={connection} isConnected={isConnected} />

        {/* コンテンツエリア */}
        <main className="content-area" data-content-area>
          {pages[currentPage]}
        </main>
      </div>
    </div>
  )
}
