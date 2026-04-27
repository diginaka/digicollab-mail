// 「自動配信として確定」モーダル
//   - delay_minutes 編集UI（5ステップそれぞれ初期値 0/1440/4320/7200/10080）
//   - 「確定」押下で fb_optin_email_sequences に upsert
//     ON CONFLICT (funnel_id, step_number) DO UPDATE
//
// props:
//   funnelId            : 必須
//   businessProfileId   : 必須（NOT NULL）
//   contents            : generated_step_contents の rows（channel='email'）
//   activeSteps         : Map<step_number, fb_optin_email_sequences row>（既存値の初期化用）
//   onClose()           : 閉じる
//   onSuccess(result)   : 成功時に呼ぶ。result = { upsertedCount }
//   onError(message)    : 失敗時に呼ぶ
import { useMemo, useState } from 'react'
import { Loader2, X, Zap, RotateCcw, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const DEFAULT_DELAYS = {
  1: 0,
  2: 1440,
  3: 4320,
  4: 7200,
  5: 10080,
}

function buildHtmlBody(text) {
  if (!text) return ''
  const esc = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const paragraphs = esc
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
  return `<!doctype html><html><body style="font-family:-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;line-height:1.7;color:#334155;max-width:600px;margin:0 auto;padding:20px;">${paragraphs}</body></html>`
}

export default function ConfirmActivationModal({
  funnelId,
  businessProfileId,
  contents,
  activeSteps,
  onClose,
  onSuccess,
  onError,
}) {
  const isReactivation = activeSteps && activeSteps.size > 0

  // 初期 delay_minutes: 既存の active row があれば既存値、なければ DEFAULT_DELAYS
  const initialDelays = useMemo(() => {
    const map = {}
    for (const step of contents || []) {
      const existing = activeSteps?.get(step.step_number)
      map[step.step_number] =
        existing?.delay_minutes ??
        DEFAULT_DELAYS[step.step_number] ??
        (step.step_number - 1) * 1440
    }
    return map
  }, [contents, activeSteps])

  const [delays, setDelays] = useState(initialDelays)
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState('')

  const handleDelayChange = (stepNumber, raw) => {
    const n = parseInt(raw, 10)
    setDelays((d) => ({
      ...d,
      [stepNumber]: Number.isFinite(n) && n >= 0 ? n : 0,
    }))
  }

  const resetDefaults = () => {
    const map = {}
    for (const step of contents || []) {
      map[step.step_number] =
        DEFAULT_DELAYS[step.step_number] ?? (step.step_number - 1) * 1440
    }
    setDelays(map)
  }

  const handleConfirm = async () => {
    setLocalError('')
    if (!funnelId) {
      setLocalError('funnel_id がありません')
      return
    }
    if (!businessProfileId) {
      setLocalError('business_profile_id を取得できませんでした')
      return
    }
    if (!contents || contents.length === 0) {
      setLocalError('登録するメールがありません')
      return
    }

    setSubmitting(true)
    try {
      const rows = contents.map((step) => ({
        funnel_id: funnelId,
        business_profile_id: businessProfileId,
        step_number: step.step_number,
        delay_minutes: delays[step.step_number] ?? 0,
        subject: step.subject || `${step.step_number}通目`,
        html_body: buildHtmlBody(step.body || ''),
        is_active: true,
      }))

      const { error, count } = await supabase
        .from('fb_optin_email_sequences')
        .upsert(rows, { onConflict: 'funnel_id,step_number', count: 'exact' })

      if (error) throw error

      onSuccess?.({ upsertedCount: count ?? rows.length })
      onClose?.()
    } catch (err) {
      const msg = err.message || '自動配信の確定に失敗しました'
      setLocalError(msg)
      onError?.(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-600" />
            {isReactivation ? '自動配信を更新する' : 'シーケンスを自動配信に乗せる'}
          </h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className={`mb-4 p-3 rounded-lg border text-xs ${
            isReactivation
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {isReactivation
            ? '現在の自動配信を上書きします。よろしいですか？'
            : 'このシーケンスを自動配信に乗せます。新規購読者に自動でメールが届くようになります。'}
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-bold text-slate-700">
              ステップ別の配信間隔（分）
            </div>
            <button
              onClick={resetDefaults}
              disabled={submitting}
              className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1 disabled:opacity-40"
              data-reset-delays
            >
              <RotateCcw className="w-3 h-3" />
              既定値に戻す
            </button>
          </div>
          <div className="space-y-1.5">
            {(contents || []).map((step) => {
              const minutes = delays[step.step_number] ?? 0
              return (
                <div
                  key={step.id}
                  className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2"
                >
                  <span className="text-xs font-bold text-emerald-700 w-12 shrink-0">
                    {step.step_number}通目
                  </span>
                  <div className="text-xs text-slate-700 flex-1 truncate">
                    {step.subject || '(件名なし)'}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={minutes}
                    onChange={(e) =>
                      handleDelayChange(step.step_number, e.target.value)
                    }
                    disabled={submitting}
                    className="w-24 px-2 py-1 border border-slate-200 rounded text-xs text-right focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                    data-step-delay={step.step_number}
                  />
                  <span className="text-[10px] text-slate-400 w-16 shrink-0 text-right">
                    {formatDelayHint(minutes)}
                  </span>
                </div>
              )
            })}
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
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 px-4 py-2 text-white rounded-lg text-sm font-bold hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ backgroundColor: '#059669' }}
            data-confirm-activation
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                登録中...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                {isReactivation ? '更新する' : '確定する'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDelayHint(minutes) {
  if (minutes <= 0) return '即時'
  if (minutes < 60) return `${minutes}分後`
  if (minutes < 1440) return `${Math.round(minutes / 60)}時間後`
  return `${Math.round(minutes / 1440)}日後`
}
