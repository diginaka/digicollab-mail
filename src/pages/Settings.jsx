import { useEffect, useState } from 'react'
import { Key, CheckCircle2, XCircle, ExternalLink, Info, Eye, EyeOff, Loader2, Unlink, Mail } from 'lucide-react'
import { getAccount, listSenders } from '../lib/brevo'
import { isSupabaseMode } from '../lib/supabase'
import { TIER_LABELS } from '../lib/tiers'

export default function Settings({ connection, setConnection, userTier, setUserTier }) {
  const [apiKeyInput, setApiKeyInput] = useState(connection.apiKey || '')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [showGuide, setShowGuide] = useState(false)
  const [senders, setSenders] = useState([])
  const [loadingSenders, setLoadingSenders] = useState(false)

  useEffect(() => {
    if (connection.isConnected && connection.apiKey) {
      loadSenders()
    }
  }, [connection.isConnected, connection.apiKey])

  const loadSenders = async () => {
    setLoadingSenders(true)
    try {
      const resp = await listSenders(connection.apiKey)
      setSenders(resp?.senders || [])
    } catch {
      setSenders([])
    } finally {
      setLoadingSenders(false)
    }
  }

  const testConnection = async () => {
    if (!apiKeyInput) {
      setTestResult({ ok: false, message: 'APIキーを入力してください' })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const account = await getAccount(apiKeyInput)
      setConnection({
        apiKey: apiKeyInput,
        accountName: account.account_name,
        email: account.email,
        planName: account.plan,
        credits: account.credits,
        creditsType: account.creditsType,
        isConnected: true,
        lastVerifiedAt: new Date().toISOString(),
        defaultSenderEmail: connection.defaultSenderEmail || '',
        defaultSenderName: connection.defaultSenderName || '',
      })
      setTestResult({
        ok: true,
        message: `接続成功！ プラン: ${account.plan}${account.credits ? ` / クレジット: ${account.credits.toLocaleString()}` : ''}`,
      })
    } catch (err) {
      setTestResult({ ok: false, message: `接続失敗: ${err.message}` })
      setConnection({ ...connection, isConnected: false })
    } finally {
      setTesting(false)
    }
  }

  const disconnect = () => {
    if (!confirm('Brevoとの接続を解除しますか？APIキーが削除されます。')) return
    setApiKeyInput('')
    setConnection({
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
    })
    setTestResult(null)
    setSenders([])
  }

  const selectDefaultSender = (senderId) => {
    const sender = senders.find((s) => String(s.id) === String(senderId))
    if (!sender) {
      setConnection({ ...connection, defaultSenderEmail: '', defaultSenderName: '' })
      return
    }
    setConnection({
      ...connection,
      defaultSenderEmail: sender.email,
      defaultSenderName: sender.name,
    })
  }

  return (
    <div className="p-6 max-w-3xl mx-auto" data-page="settings">
      {/* 初期セットアップ案内 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-5" data-setup-guide>
        <div className="flex items-start gap-2 mb-3">
          <Info className="w-5 h-5 text-yellow-700 shrink-0 mt-0.5" />
          <h3 className="font-bold text-yellow-900">初期セットアップ手順</h3>
        </div>
        <ol className="space-y-2 text-sm text-yellow-900 list-decimal list-inside ml-1">
          <li>Brevoに無料アカウントを作成（コンタクト無制限・300通/日まで無料）</li>
          <li>右上のアカウント名 → 「SMTP &amp; API」を開く</li>
          <li>「API Keys」タブで「Generate a new API key」をクリック</li>
          <li>キー名を入力（例：デジコラボ）して発行</li>
          <li>発行されたキーを下のフィールドに貼り付け → 「接続テスト」</li>
        </ol>
        <div className="flex items-center gap-3 mt-3">
          <a
            href="https://app.brevo.com/settings/keys/api"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-bold text-yellow-800 hover:text-yellow-900"
          >
            APIキー管理画面を開く <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="text-sm font-bold text-yellow-800 hover:text-yellow-900 underline"
          >
            {showGuide ? '詳細ガイドを閉じる' : '詳細ガイドを見る'}
          </button>
        </div>
        {showGuide && (
          <div className="mt-3 p-3 bg-white rounded-lg text-xs text-slate-700 space-y-1.5 border border-yellow-200">
            <p>⚠️ APIキーは一度しか表示されません。必ずコピーして保管してください。</p>
            <p>ℹ️ Brevoの無料プランでは HTMLテンプレート作成・APIでのメール送信・スケジュール送信すべて利用可能です。</p>
            <p>ℹ️ 送信には「認証済み送信者」が必要です。接続後、下のセクションから設定してください。</p>
          </div>
        )}
      </div>

      {/* API接続 */}
      <Section icon={Key} title="Brevo API接続">
        <Field label="APIキー">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="xkeysib-..."
              className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-500"
              data-api-key-input
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={testConnection}
            disabled={testing}
            className="px-4 py-2 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            style={{ backgroundColor: '#059669' }}
            data-test-connection
          >
            {testing && <Loader2 className="w-4 h-4 animate-spin" />}
            接続テスト
          </button>
          {connection.isConnected && (
            <button
              onClick={disconnect}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 flex items-center gap-1.5"
            >
              <Unlink className="w-4 h-4" />
              接続解除
            </button>
          )}
        </div>

        {testResult && (
          <div
            className={`mt-3 p-3 rounded-lg text-sm flex items-start gap-2 ${
              testResult.ok
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </Section>

      {/* 接続ステータス */}
      {connection.isConnected && (
        <Section icon={CheckCircle2} title="現在の接続状態">
          <dl className="text-sm space-y-2">
            <InfoRow label="アカウント名" value={connection.accountName || '—'} />
            <InfoRow label="メール" value={connection.email || '—'} />
            <InfoRow label="プラン" value={connection.planName || 'free'} />
            <InfoRow
              label="クレジット"
              value={
                connection.credits != null
                  ? `${Number(connection.credits).toLocaleString()} ${connection.creditsType || ''}`
                  : '—'
              }
            />
            <InfoRow
              label="最終検証"
              value={connection.lastVerifiedAt ? new Date(connection.lastVerifiedAt).toLocaleString('ja-JP') : '—'}
            />
          </dl>
        </Section>
      )}

      {/* 送信者設定（Brevo固有） */}
      {connection.isConnected && (
        <Section icon={Mail} title="デフォルト送信者">
          <div className="text-xs text-slate-500 mb-3">
            キャンペーン・自動配信で使うデフォルトの送信者を選択します。Brevoで認証済みの送信者のみ表示されます。
          </div>
          {loadingSenders ? (
            <div className="py-4 flex justify-center text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : senders.length === 0 ? (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              認証済み送信者がまだありません。Brevoで送信元メールアドレスを追加・認証してください。
              <a
                href="https://app.brevo.com/senders/list"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 ml-1 font-bold underline"
              >
                Brevoで送信者を追加 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <select
              value={senders.find((s) => s.email === connection.defaultSenderEmail)?.id || ''}
              onChange={(e) => selectDefaultSender(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
              data-default-sender
            >
              <option value="">送信者を選択...</option>
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} &lt;{s.email}&gt; {s.active ? '' : '（未認証）'}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={loadSenders}
            className="mt-2 text-xs text-emerald-600 hover:text-emerald-700 font-bold"
          >
            再読み込み
          </button>
        </Section>
      )}

      {/* Supabase連携モード時のみ表示 */}
      {isSupabaseMode && (
        <Section icon={Key} title="デジコラボメンバーシップ（開発用）">
          <div className="text-xs text-slate-500 mb-2">
            ※ 本番環境ではフロービルダーSSOのセッションmetadataから自動判定されます。開発確認用の手動切替：
          </div>
          <select
            value={userTier}
            onChange={(e) => setUserTier(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
          >
            {Object.entries(TIER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Section>
      )}

      {/* 外部リンク集 */}
      <Section icon={ExternalLink} title="Brevo 外部リンク">
        <div className="space-y-2">
          <LinkRow href="https://app.brevo.com" label="Brevo ダッシュボード" />
          <LinkRow href="https://app.brevo.com/senders/list" label="送信者管理（送信元メール設定）" />
          <LinkRow href="https://app.brevo.com/senders/domain/list" label="ドメイン認証" />
          <LinkRow href="https://app.brevo.com/contact/list" label="コンタクトリスト管理" />
          <LinkRow href="https://app.brevo.com/settings/keys/api" label="APIキー管理" />
          <LinkRow href="https://developers.brevo.com/" label="Brevo API ドキュメント" />
        </div>
      </Section>
    </div>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-emerald-600" />
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      {children}
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

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <dt className="text-slate-500 w-24 shrink-0 text-xs">{label}</dt>
      <dd className="text-slate-800 flex-1 font-medium">{value}</dd>
    </div>
  )
}

function LinkRow({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700"
    >
      <span>{label}</span>
      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
    </a>
  )
}
