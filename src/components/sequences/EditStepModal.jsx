// 各メールカードの編集モーダル
//
// 配信系結線完成 (バグ #4 / 2026-04-28):
//   シーケンス画面の各通をクリックして件名・本文・配信日数を編集できる UI。
//   保存先は generated_step_contents (subject, body, day, preview)。
//   既に「自動配信として確定」済みの場合は fb_optin_email_sequences 側の
//   subject / html_body / delay_minutes も同時に UPDATE して、
//   進行中シーケンスの次配信から編集が反映されるようにする。
//
// 取り扱う型:
//   step (props) は generated_step_contents の row。{ id, step_number, subject,
//   body, preview, day, metadata, ... }
//
// 失敗時の挙動:
//   - generated_step_contents UPDATE が失敗したら全体 失敗扱い (赤帯)
//   - fb_optin_email_sequences UPDATE は best-effort (warn のみ)
import { useEffect, useState } from 'react'
import { Loader2, X, Save, AlertTriangle, Mail } from 'lucide-react'
import { supabase, isSupabaseMode } from '../../lib/supabase'

/**
 * 構造化 body を期待しないシンプルテキストエディタ。
 * generated_step_contents.body は flatten 済みの単一 TEXT なので、ここでも
 * そのまま単一 textarea で扱う。
 */
function buildHtmlFromText(text) {
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

export default function EditStepModal({
  step,
  funnelId,
  onClose,
  onSaved,
  onError,
}) {
  const [subject, setSubject] = useState(step?.subject ?? '')
  const [body, setBody] = useState(step?.body ?? '')
  const [day, setDay] = useState(
    Number.isFinite(step?.day) ? String(step.day) : ''
  )
  const [preview, setPreview] = useState(step?.preview ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState('')

  // step が変わったら state リセット (リスト切替対策)
  useEffect(() => {
    setSubject(step?.subject ?? '')
    setBody(step?.body ?? '')
    setDay(Number.isFinite(step?.day) ? String(step.day) : '')
    setPreview(step?.preview ?? '')
    setLocalError('')
  }, [step?.id])

  const handleSave = async () => {
    setLocalError('')
    if (!isSupabaseMode || !supabase) {
      setLocalError('Supabase 接続が必要です')
      return
    }
    if (!step?.id) {
      setLocalError('編集対象のメールが特定できません')
      return
    }
    const trimmedSubject = subject.trim()
    if (!trimmedSubject) {
      setLocalError('件名は必須です')
      return
    }
    const dayNum =
      day === '' || day === null || day === undefined
        ? null
        : Number.parseInt(day, 10)
    if (dayNum !== null && (!Number.isFinite(dayNum) || dayNum < 0)) {
      setLocalError('配信日（day）は 0 以上の整数で指定してください')
      return
    }

    setSubmitting(true)
    try {
      // 1. generated_step_contents 本体を UPDATE
      const { error: gscErr } = await supabase
        .from('generated_step_contents')
        .update({
          subject: trimmedSubject,
          body,
          preview: preview || null,
          day: dayNum,
          // metadata.delay_days を整合させる目的で、metadata 全体を read-modify-write
          // するのは race の温床になるため day の 1 次情報は本テーブルの day カラムに
          // 任せる。metadata は AI 生成時に書かれた値をそのまま温存する。
          updated_at: new Date().toISOString(),
        })
        .eq('id', step.id)
      if (gscErr) throw gscErr

      // 2. fb_optin_email_sequences 側にも反映 (進行中シーケンスへの即時反映)。
      //    存在しない場合（まだ「自動配信として確定」未実行）は no-op。
      const sequenceUpdates = {
        subject: trimmedSubject,
        html_body: buildHtmlFromText(body || ''),
        updated_at: new Date().toISOString(),
      }
      if (dayNum !== null) {
        sequenceUpdates.delay_minutes = Math.max(0, dayNum) * 1440
      }
      const { error: seqErr } = await supabase
        .from('fb_optin_email_sequences')
        .update(sequenceUpdates)
        .eq('funnel_id', funnelId)
        .eq('step_number', step.step_number)
      if (seqErr) {
        console.warn(
          '[EditStepModal] fb_optin_email_sequences UPDATE failed (non-fatal):',
          seqErr,
        )
      }

      onSaved?.({
        stepId: step.id,
        stepNumber: step.step_number,
        subject: trimmedSubject,
      })
      onClose?.()
    } catch (err) {
      const msg = err?.message || '保存に失敗しました'
      setLocalError(msg)
      onError?.(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-600" />
            メール編集（{step?.step_number ?? '-'}通目）
          </h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              件名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={submitting}
              maxLength={200}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              data-edit-subject
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              プレビューテキスト
              <span className="ml-1 text-[10px] text-slate-400 font-normal">
                受信箱で件名の隣に表示される短文
              </span>
            </label>
            <input
              type="text"
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              disabled={submitting}
              maxLength={200}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              data-edit-preview
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              配信日（day）
              <span className="ml-1 text-[10px] text-slate-400 font-normal">
                オプトインから何日後に送信するか（0=即時）
              </span>
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              disabled={submitting}
              className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              data-edit-day
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              本文
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={submitting}
              rows={14}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-sans focus:outline-none focus:border-emerald-500 disabled:opacity-50 leading-relaxed"
              placeholder="メール本文..."
              data-edit-body
            />
            <div className="mt-1 text-[11px] text-slate-400">
              ※ {'{{name}}'} は配信時に受信者名へ置換されます
            </div>
          </div>
        </div>

        {localError && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{localError}</div>
          </div>
        )}

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="flex-1 px-4 py-2 text-white rounded-lg text-sm font-bold hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ backgroundColor: '#059669' }}
            data-edit-save
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
