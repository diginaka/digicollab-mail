// フロービルダーからiframeで開かれた際の funnel_id パラメータを取得
import { useEffect, useState } from 'react'

export function useFlowContext() {
  const [funnelId, setFunnelId] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('funnel_id')
    setFunnelId(id)
  }, [])

  return {
    funnelId,
    isEmbedded: !!funnelId,
  }
}
