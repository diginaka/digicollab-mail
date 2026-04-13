import { useState } from 'react'
import { Key, CheckCircle2, XCircle, ExternalLink, Info, Eye, EyeOff, Loader2, Unlink } from 'lucide-react'
import { getAccount } from '../lib/mailerlite'
import { isSupabaseMode } from '../lib/supabase'
import { TIER_LABELS } from '../lib/tiers'

export default function Settings({ connection, setConnection, userTier, setUserTier }) {
  const [apiKeyInput, setApiKeyInput] = useState(connection.apiKey || '')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [showGuide, setShowGuide] = useState(false)

  const testConnection = async () => {
    if (!apiKeyInput) {
      setTestResult({ ok: false, message: 'APIキーを入力してください' })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const resp = await getAccount(apiKeyInput)
      const account = resp.data || resp
      setConnection({
        apiKey: apiKeyInput,
        accountName: account.account_name || account.name || account.email || 'MailerLite アカウント',
        planName: account.plan || account.subscription?.plan || 'free',
        subscriberLimit: account.subscribers_limit || 500,
        isConnected: true,
        lastVerifiedAt: new Date().toISOString(),
      })
      setTestResult({
        ok: true,
        message: `接続成功！ 登録者数: ${account.total_subscribers || 0}人`,
      })
    } catch (err) {
      setTestResult({ ok: false, message: `接続失敗: ${err.message}` })
      setConnection({ ...connection, isConnected: false })
    } finally {
      setTesting(false)
    }
  }

  const disconnect = () => {
    if (!confirm('MailerLiteとの接続を解除しますか？APIキーが削除されます。')) return
    setApiKeyInput('')
    setConnection({
      apiKey: '',
      accountName: '',
      planName: '',
      subscriberLimit: 0,
      isConnected: false,
      lastVerifiedAt: null,
    })
    setTestResult(null)
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
          <li>MailerLiteに無料アカウントを作成（500人まで無料）</li>
          <li>左メニュー「Integrations」→「MailerLite API」</li>
          <li>「Generate new token」をクリックしてAPIキーを発行</li>
          <li>発行されたキーを下のフィールドに貼り付け</li>
          <li>「接続テスト」で動作確認</li>
        </ol>
        <div className="flex items-center gap-3 mt-3">
          <a
            href="https://app.mailerlite.com/integrations/api"
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
            <p>⚠️ メール本文のHTMLデザイン編集はMailerLite Advancedプラン（$18/月）以上が必要です。無料/Growing Businessプランではこのツールからはデザイン編集できません（MailerLite本体のドラッグ＆ドロップエディタを使ってください）。</p>
            <p>ℹ️ レート制限: 120リクエスト/分（MailerLite側）</p>
          </div>
        )}
      </div>

      {/* API接続 */}
      <Section icon={Key} title="MailerLite API接続">
        <Field label="APIキー">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOi..."
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
            <InfoRow label="プラン" value={connection.planName || 'free'} />
            <InfoRow label="登録者上限" value={`${connection.subscriberLimit?.toLocaleString() || '—'} 人`} />
            <InfoRow
              label="最終検証"
              value={connection.lastVerifiedAt ? new Date(connection.lastVerifiedAt).toLocaleString('ja-JP') : '—'}
            />
          </dl>
        </Section>
      )}

      {/* Supabase連携モード時のみ表示 */}
      {isSupabaseMode && (
        <Section icon={Key} title="デジコラボメンバーシップ（開発用）">
          <div className="text-xs text-slate-500 mb-2">
            ※ 本番環境ではdigicollabo_membersテーブルで自動判定されます。開発確認用の手動切替：
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
      <Section icon={ExternalLink} title="MailerLite 外部リンク">
        <div className="space-y-2">
          <LinkRow href="https://app.mailerlite.com" label="MailerLite ダッシュボード" />
          <LinkRow href="https://app.mailerlite.com/domains" label="ドメイン認証（送信元メール設定）" />
          <LinkRow href="https://app.mailerlite.com/subscribers/segments/create" label="セグメント作成" />
          <LinkRow href="https://app.mailerlite.com/automation/create" label="オートメーション作成" />
          <LinkRow href="https://developers.mailerlite.com/" label="MailerLite API ドキュメント" />
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
