// 自動配信セットアップフック
// フロービルダーから渡される funnel_id のAI生成メール一式を
// Brevoのトランザクショナルメール予約送信APIで一括配信予約する。
//
// 配信系結線完成 (バグ #1 / 2026-04-28):
//   既存購読者向けの Brevo 予約配信 (delivery_queue) に加え、
//   公開 LP からの新規オプトイン用に fb_optin_email_sequences へも UPSERT する。
//   これで「自動配信をセットアップ」の一発で、
//     - 既存リスト購読者: Brevo 予約配信
//     - 新規オプトイン者: fb-optin-submit 経由の自動配信トリガー
//   の双方が同時に有効化される。
import { useCallback, useState } from 'react'
import { sendTransactionalEmail } from '../lib/brevo'
import { supabase, isSupabaseMode } from '../lib/supabase'

/**
 * プレーンテキストを簡易HTMLに変換
 */
function buildHtml(text) {
  if (!text) return ''
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const paragraphs = esc.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
  return `<!doctype html><html><body style="font-family:-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;line-height:1.7;color:#334155;max-width:600px;margin:0 auto;padding:20px;">${paragraphs}</body></html>`
}

/**
 * delay_days から scheduledAt（ISO 8601 UTC）を計算
 */
function computeScheduledAt(baseDate, delayDays) {
  const d = new Date(baseDate)
  d.setDate(d.getDate() + (Number(delayDays) || 0))
  return d.toISOString()
}

/**
 * generated_step_contents 行から fb_optin_email_sequences 用の row を組み立てる。
 * delay_minutes は metadata.delay_days × 1440 を基本に、フォロー側 (timing) や
 * 既存 step_number からの推定でフォールバックする。
 *
 * バグ #1 対応: ConfirmActivationModal と同じ shape (UPSERT onConflict
 * 'funnel_id,step_number') で書き込むため、両導線で更新値が衝突しない。
 */
function buildOptinSequenceRows({ funnelId, businessProfileId, steps }) {
  return steps.map((step) => {
    const delayDays =
      step.metadata?.delay_days ?? step.day ?? step.step_number - 1
    const delayMinutes = Math.max(0, Number(delayDays) || 0) * 1440
    const subject = step.subject || `${step.step_number}通目`
    const html = buildHtml(step.body || '')
    return {
      funnel_id: funnelId,
      business_profile_id: businessProfileId,
      step_number: step.step_number,
      delay_minutes: delayMinutes,
      subject,
      html_body: html,
      is_active: true,
    }
  })
}

/**
 * AI生成メール一覧を受け取り、Brevoで予約配信する
 */
export function useAutoDeliverySetup({ apiKey, sender }) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  /**
   * @param {object} params
   * @param {string} params.funnelId
   * @param {string} params.funnelName
   * @param {string} params.businessProfileId   バグ #1 対応: fb_optin_email_sequences UPSERT 用
   * @param {Array<{email:string, firstname?:string, lastname?:string}>} params.recipients
   * @param {Array<{id:string, step_number:number, subject:string, body:string, metadata:object}>} params.steps
   * @param {Date} [params.baseDate] 起点日時（デフォルトは今）
   */
  const setup = useCallback(
    async ({ funnelId, funnelName, businessProfileId, recipients, steps, baseDate }) => {
      if (!apiKey) {
        setError('APIキーが設定されていません')
        return { ok: false }
      }
      if (!sender?.email) {
        setError('デフォルト送信者が未設定です。設定画面で認証済み送信者を選択してください。')
        return { ok: false }
      }
      if (!recipients?.length) {
        setError('配信対象のコンタクトが選択されていません')
        return { ok: false }
      }
      if (!steps?.length) {
        setError('配信するメールがありません')
        return { ok: false }
      }

      setRunning(true)
      setError(null)
      setResult(null)
      const total = recipients.length * steps.length
      setProgress({ done: 0, total })

      const startAt = baseDate ? new Date(baseDate) : new Date()
      const queueRows = []
      const errors = []
      let done = 0

      // バグ #1: 公開LP オプトイン用の自動配信トリガー (fb_optin_email_sequences) を
      //   先に UPSERT する。Brevo 予約配信より前に DB 書込しておくことで、
      //   仮に Brevo 側が落ちても新規オプトインの自動配信は機能する。
      let optinSequenceUpserted = 0
      let optinSequenceError = null
      if (
        isSupabaseMode &&
        supabase &&
        funnelId &&
        businessProfileId &&
        steps.length > 0
      ) {
        const optinRows = buildOptinSequenceRows({
          funnelId,
          businessProfileId,
          steps,
        })
        const { error: optinErr, count } = await supabase
          .from('fb_optin_email_sequences')
          .upsert(optinRows, {
            onConflict: 'funnel_id,step_number',
            count: 'exact',
          })
        if (optinErr) {
          optinSequenceError = optinErr.message || '自動配信トリガーの保存に失敗しました'
          errors.push({ message: `自動配信トリガー保存失敗: ${optinSequenceError}` })
        } else {
          optinSequenceUpserted = count ?? optinRows.length
        }
      } else if (funnelId && !businessProfileId) {
        // businessProfileId が無いと UPSERT できない（NOT NULL 制約）。warn のみで続行。
        errors.push({
          message:
            'business_profile_id が取得できなかったため、新規オプトインの自動配信は登録されませんでした',
        })
      }

      for (const recipient of recipients) {
        for (const step of steps) {
          const delayDays = step.metadata?.delay_days ?? (step.step_number - 1)
          const scheduledAt = computeScheduledAt(startAt, delayDays)
          const html = buildHtml(step.body || '')
          const subject = step.subject || `${step.step_number}通目`

          try {
            const resp = await sendTransactionalEmail(apiKey, {
              to: [
                {
                  email: recipient.email,
                  name: [recipient.firstname, recipient.lastname].filter(Boolean).join(' ') || undefined,
                },
              ],
              subject,
              htmlContent: html,
              sender,
              scheduledAt,
              tags: [`funnel:${funnelId}`, `step:${step.step_number}`],
            })

            queueRows.push({
              funnel_id: funnelId,
              funnel_name: funnelName,
              step_number: step.step_number,
              step_content_id: step.id,
              recipient_email: recipient.email,
              scheduled_at: scheduledAt,
              status: 'scheduled',
              brevo_message_id: resp?.messageId || null,
              subject,
            })
          } catch (err) {
            errors.push({ email: recipient.email, step: step.step_number, message: err.message })
            queueRows.push({
              funnel_id: funnelId,
              funnel_name: funnelName,
              step_number: step.step_number,
              step_content_id: step.id,
              recipient_email: recipient.email,
              scheduled_at: scheduledAt,
              status: 'failed',
              error_message: err.message,
              subject,
            })
          } finally {
            done += 1
            setProgress({ done, total })
          }
        }
      }

      // Supabaseの delivery_queue に保存（Supabase連携時のみ）
      if (isSupabaseMode && supabase && queueRows.length > 0) {
        const { error: insertError } = await supabase.from('delivery_queue').insert(queueRows)
        if (insertError) {
          errors.push({ message: `配信キュー保存失敗: ${insertError.message}` })
        }
      }

      const successCount = queueRows.filter((r) => r.status === 'scheduled').length
      const failedCount = queueRows.filter((r) => r.status === 'failed').length

      const finalResult = {
        // Brevo 予約配信が全成功 + 自動配信トリガーもエラー無しの時のみ ok
        ok: failedCount === 0 && !optinSequenceError,
        successCount,
        failedCount,
        // バグ #1 対応: 新規オプトイン用自動配信の登録結果も返す
        optinSequenceUpserted,
        optinSequenceError,
        errors,
        queueRows,
      }
      setResult(finalResult)
      setRunning(false)
      return finalResult
    },
    [apiKey, sender]
  )

  const reset = useCallback(() => {
    setError(null)
    setResult(null)
    setProgress({ done: 0, total: 0 })
  }, [])

  return { setup, running, progress, error, result, reset }
}
