// 自動配信セットアップフック
// フロービルダーから渡される funnel_id のAI生成メール一式を
// Brevoのトランザクショナルメール予約送信APIで一括配信予約する。
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
   * @param {Array<{email:string, firstname?:string, lastname?:string}>} params.recipients
   * @param {Array<{id:string, step_number:number, subject:string, body:string, metadata:object}>} params.steps
   * @param {Date} [params.baseDate] 起点日時（デフォルトは今）
   */
  const setup = useCallback(
    async ({ funnelId, funnelName, recipients, steps, baseDate }) => {
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
        ok: failedCount === 0,
        successCount,
        failedCount,
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
