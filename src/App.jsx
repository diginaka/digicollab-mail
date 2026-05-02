import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, FolderTree, Send, BarChart3, Workflow,
  Settings as SettingsIcon, Loader2,
} from 'lucide-react'
import { localStore, isSupabaseMode, supabase } from './lib/supabase'
import { initSSO, startSessionPolling } from './lib/initSSO'
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
  // Supabase Auth セッション管理（SSO対応）
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(!isSupabaseMode) // standaloneなら即ready

  useEffect(() => {
    if (!isSupabaseMode || !supabase) return

    let stopPolling = () => {}
    let subscription

    ;(async () => {
      // 1) 起動時: URLから sso_code / sso_token / sso_refresh を読み取ってセッション注入
      //    セッション無し時は redirectToHub() が内部で呼ばれる
      await initSSO()

      // 2) 現在のセッション取得
      const {
        data: { session: current },
      } = await supabase.auth.getSession()
      setSession(current)
      setReady(true)

      // 3) セッション監視（共通SSOクライアント版: サインアウト→ハブ誘導、user切替→リロード）
      if (current) {
        stopPolling = startSessionPolling(current.user.id)
      }
    })()

    // 4) 認証状態変化を検知（ポーリングも再始動）
    const sub = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      stopPolling()
      stopPolling = s ? startSessionPolling(s.user.id) : () => {}
    })
    subscription = sub.data.subscription

    return () => {
      if (subscription) subscription.unsubscribe()
      stopPolling()
    }
  }, [])

  // 初期化完了待ち
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-digi-bg">
        <Loader2 className="w-6 h-6 animate-spin text-digi-green" />
      </div>
    )
  }

  // Supabaseモードで未ログイン → フロービルダー本体への誘導
  if (isSupabaseMode && !session) {
    return <FlowBuilderRedirect />
  }

  // ログイン済み or スタンドアロンモード → メインアプリ表示
  return <MainApp session={session} />
}

function FlowBuilderRedirect() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 bg-digi-bg"
      data-sso-redirect
    >
      <div className="text-center max-w-md">
        <p className="text-digi-text-muted leading-relaxed mb-6">
          このアプリはフロービルダーの一部です。
          <br />
          フロービルダー本体からアクセスしてください。
        </p>
        <a
          href="https://digicollabo.com"
          className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-lg font-bold hover:opacity-90 transition-opacity bg-digi-green"
        >
          フロービルダーを開く
          <span aria-hidden>↗</span>
        </a>
      </div>
    </div>
  )
}

function MainApp({ session }) {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [connection, setConnection] = useState(() => ({
    ...DEFAULT_CONNECTION,
    ...localStore.get('connection', {}),
  }))

  // ティア: SSOセッションの user_metadata から判定（本番）
  // スタンドアロンモードは partner（全機能アンロック）、Supabase連携時のデフォルトは member
  const [userTier, setUserTier] = useState(() => {
    if (!isSupabaseMode) return 'partner'
    const meta = session?.user?.user_metadata || session?.user?.app_metadata || {}
    return meta.tier || meta.membership_tier || localStore.get('userTier', 'member')
  })

  useEffect(() => {
    localStore.set('connection', connection)
  }, [connection])

  useEffect(() => {
    localStore.set('userTier', userTier)
  }, [userTier])

  // セッションのmetadataが更新された場合にティアを反映
  useEffect(() => {
    if (!isSupabaseMode || !session) return
    const meta = session.user?.user_metadata || session.user?.app_metadata || {}
    const t = meta.tier || meta.membership_tier
    if (t && t !== userTier) setUserTier(t)
  }, [session])

  const isConnected = Boolean(connection.apiKey && connection.isConnected)

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

  // Phase B 拡張版: ホワイトラベル化 + 細サイドバー (アイコンのみ + ホバー tooltip) +
  // 右上 🟢 ステータスドット 1 個。ブランド名 + ロゴ画像撤去。
  return (
    <div className="app-container">
      {/* 細サイドバー (w-14、アイコンのみ、ホバー tooltip) */}
      <aside
        className="w-14 flex flex-col bg-digi-sidebar"
      >
        {/* スペーサー (上部 align、ロゴ + ブランド名は撤去 = ホワイトラベル化) */}
        <div className="h-12 border-b border-white/10" aria-hidden />

        <nav className="flex-1 py-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = currentPage === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentPage(item.id)}
                title={item.label}
                aria-label={item.label}
                className={`w-full h-10 flex items-center justify-center transition-colors ${
                  active
                    ? 'text-white bg-white/10 border-l-[3px] border-digi-green-light'
                    : 'text-white/55 hover:text-white hover:bg-white/5 border-l-[3px] border-transparent'
                }`}
                data-nav={item.id}
              >
                <Icon className="w-5 h-5" />
              </button>
            )
          })}
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <div className="main-content">
        {/* 薄ヘッダー: 右上 🟢 ステータスドット 1 個のみ */}
        <header className="h-12 bg-white border-b border-digi-border flex items-center justify-between px-4 shrink-0">
          <h1 className="text-sm font-semibold text-digi-text">
            {NAV.find((n) => n.id === currentPage)?.label}
          </h1>
          {/* 右上 🟢 ステータスドット (接続/未接続のみ) */}
          <span
            className="flex items-center gap-1.5 text-xs text-digi-text-muted"
            data-connection-status
            title={
              isConnected
                ? `Brevo 接続済${connection.accountName ? ` (${connection.accountName})` : ''}`
                : 'Brevo 未接続'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-digi-green-light' : 'bg-digi-text-muted/40'
              }`}
              aria-hidden
            />
          </span>
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
