// シーケンスの状態（empty / draft / active / error）を判定するフック
//
// 判定ロジック:
//   - empty : generated_step_contents (channel='email') の email が 0 件
//   - draft : email がある + fb_optin_email_sequences に未投入
//   - active: fb_optin_email_sequences (funnel_id) に1件以上ある
//   - error : active かつ 直近の fb_optin_email_log で status='failed' あり
//
// activeSteps Map は (step_number) → fb_optin_email_sequences row。
// 各メールカードの「✓ 自動配信中」バッジ判定に使う。
import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseMode } from '../lib/supabase'

const RECENT_FAILED_WINDOW_HOURS = 72

export function useSequenceStatus(funnelId) {
  const [state, setState] = useState({
    status: 'empty',
    draftCount: 0,
    activeSteps: new Map(),
    hasFailedRecent: false,
    loading: false,
    error: null,
  })

  const load = useCallback(async () => {
    if (!isSupabaseMode || !supabase || !funnelId) {
      setState({
        status: 'empty',
        draftCount: 0,
        activeSteps: new Map(),
        hasFailedRecent: false,
        loading: false,
        error: null,
      })
      return
    }

    setState((s) => ({ ...s, loading: true, error: null }))

    try {
      // 並列クエリ
      const [draftRes, activeRes] = await Promise.all([
        supabase
          .from('generated_step_contents')
          .select('id', { count: 'exact', head: true })
          .eq('funnel_id', funnelId)
          .eq('channel', 'email'),
        supabase
          .from('fb_optin_email_sequences')
          .select('id, step_number, delay_minutes, subject, html_body, is_active, updated_at')
          .eq('funnel_id', funnelId)
          .order('step_number', { ascending: true }),
      ])

      if (draftRes.error) throw draftRes.error
      if (activeRes.error) throw activeRes.error

      const draftCount = draftRes.count || 0
      const activeRows = activeRes.data || []
      const activeSteps = new Map()
      activeRows.forEach((r) => activeSteps.set(r.step_number, r))

      // 直近 status='failed' チェック（active な場合のみ）
      let hasFailedRecent = false
      if (activeRows.length > 0) {
        const sequenceIds = activeRows.map((r) => r.id)
        const sinceIso = new Date(
          Date.now() - RECENT_FAILED_WINDOW_HOURS * 3600 * 1000
        ).toISOString()
        const { data: failedRows, error: failedErr } = await supabase
          .from('fb_optin_email_log')
          .select('id')
          .in('sequence_id', sequenceIds)
          .eq('status', 'failed')
          .gte('created_at', sinceIso)
          .limit(1)
        if (!failedErr) {
          hasFailedRecent = (failedRows?.length || 0) > 0
        }
      }

      let status = 'empty'
      if (activeRows.length > 0) {
        status = hasFailedRecent ? 'error' : 'active'
      } else if (draftCount > 0) {
        status = 'draft'
      }

      setState({
        status,
        draftCount,
        activeSteps,
        hasFailedRecent,
        loading: false,
        error: null,
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err.message || 'シーケンス状態の取得に失敗しました',
      }))
    }
  }, [funnelId])

  useEffect(() => {
    load()
  }, [load])

  return { ...state, refresh: load }
}
