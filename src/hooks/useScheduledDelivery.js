// 予約配信の状況を監視するフック
// Supabase の delivery_queue テーブルを参照して、指定 funnel_id の配信進捗を返す。
import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseMode } from '../lib/supabase'

/**
 * @param {string|null} funnelId
 */
export function useScheduledDelivery(funnelId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!funnelId || !isSupabaseMode || !supabase) {
      setItems([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('delivery_queue')
        .select('*')
        .eq('funnel_id', funnelId)
        .order('scheduled_at', { ascending: true })

      if (fetchError) throw fetchError
      setItems(data || [])
    } catch (err) {
      setError(err.message || '配信キュー取得エラー')
    } finally {
      setLoading(false)
    }
  }, [funnelId])

  useEffect(() => {
    load()
  }, [load])

  // ステータスごとの集計
  const summary = items.reduce(
    (acc, item) => {
      acc.total += 1
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    },
    { total: 0 }
  )

  // ユニークな配信先数
  const uniqueRecipients = new Set(items.map((i) => i.recipient_email)).size

  return {
    items,
    summary,
    uniqueRecipients,
    loading,
    error,
    refresh: load,
    hasActiveDelivery: items.some((i) => i.status === 'scheduled' || i.status === 'sending'),
  }
}
