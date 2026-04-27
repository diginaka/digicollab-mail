// 各メールカード単位の「テスト送信」モーダル
// fb-optin-submit Edge Function を test_mode=true で叩く（v10.1: test_step_number 対応）。
//
// 注意: 未確定（fb_optin_email_sequences に該当 step が無い）状態では
// このモーダル自体を呼び出さない（呼び出し側で disabled 制御済み）。
import { useState } from 'react'
import { Loader2, X, Send, AlertTriangle, Mail } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function TestSendModal({
  funnelId,
  businessProfileId,
  stepNumber,
  defaultEmail,
  subjectPreview,
  onClose,
  onSuccess,
  onError,
}) {
  const [recipient, setRecipient] = useState(defaultEmail || '')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState('')

  const isValidEmail = EMAIL_RE.test(recipient.trim())

  const handleSend = async () => {
    setLocalError('')
    if (!isValidEmail) {
      setLocalError('メールアドレスの形式が正しくありません')
      return
    }
    if (!funnelId) {
      setLocalError('funnel_id がありません')
      return
    }
    if (!businessProfileId) {
      setLocalError('business_profile_id を取得できませんでした')
      return
    }
    if (!SUPABASE_URL || !ANON_KEY) {
      setLocalError('Supabase 環境変数が設定されていません')
      return
    }

    setSubmitting(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('ログインセッションが切れています。再ログインしてください。')
      }

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/fb-optin-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            test_mode: true,
            funnel_id: funnelId,
            business_profile_id: businessProfileId,
            test_recipient_email: recipient.trim(),
            test_step_number: stepNumber,
          }),
        }
      )

      const text = await res.text()
      let json = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {}

      if (!res.ok) {
        const detail =
          json?.error || json?.message || text || `HTTP ${res.status}`
        throw new Error(`テスト送信に失敗しました: ${detail}`)
      }

      onSuccess?.({
        recipient: recipient.trim(),
        stepNumber,
        response: json,
      })
      onClose?.()
    } catch (err) {
      const msg = err.message || 'テスト送信に失敗しました'
      setLocalError(msg)
      onError?.(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-600" />
            テスト送信（{stepNumber}通目）
          </h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {subjectPreview && (
          <div className="mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
            <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
            <div className="truncate">{subjectPreview}</div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            送信先メールアドレス
          </label>
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={submitting}
            placeholder="test@example.com"
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none disabled:opacity-50 ${
              recipient && !isValidEmail
                ? 'border-red-300 focus:border-red-500'
                : 'border-slate-200 focus:border-emerald-500'
            }`}
            data-test-recipient
          />
          {recipient && !isValidEmail && (
            <div className="mt-1 text-[11px] text-red-600">
              メールアドレスの形式を確認してください
            </div>
          )}
          <div className="mt-1 text-[11px] text-slate-400">
            ※ ログインユーザーのメールアドレスが初期値です。配信ログには記録されません。
          </div>
        </div>

        {localError && (
          <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{localError}</div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            キャンセル
          </button>
          <button
            onClick={handleSend}
            disabled={submitting || !isValidEmail}
            className="flex-1 px-4 py-2 text-white rounded-lg text-sm font-bold hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ backgroundColor: '#059669' }}
            data-confirm-test-send
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                送信中...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                送信
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
