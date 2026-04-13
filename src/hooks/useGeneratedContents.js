// フロービルダーで AI 生成されたメールコンテンツを取得
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useGeneratedContents(funnelId, channel = 'email') {
  const [contents, setContents] = useState([])
  const [funnelName, setFunnelName] = useState(null)
  const [patternName, setPatternName] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!funnelId || !supabase) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('generated_step_contents')
        .select('*')
        .eq('funnel_id', funnelId)
        .eq('channel', channel)
        .order('step_number', { ascending: true })

      if (fetchError) throw fetchError

      if (data && data.length > 0) {
        setContents(data)
        setFunnelName(data[0].funnel_name)
        setPatternName(data[0].pattern_name)
      } else {
        setContents([])
        setFunnelName(null)
        setPatternName(null)
      }
    } catch (err) {
      setError(err.message || '取得エラー')
    } finally {
      setLoading(false)
    }
  }, [funnelId, channel])

  useEffect(() => {
    load()
  }, [load])

  return { contents, funnelName, patternName, loading, error, refresh: load }
}
