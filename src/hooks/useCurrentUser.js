// 現在ログイン中の Supabase ユーザー情報を取得する小フック
// session.user.email / access_token を使う場面（テスト送信、Edge Function 呼び出し等）で利用。
import { useEffect, useState } from 'react'
import { supabase, isSupabaseMode } from '../lib/supabase'

export function useCurrentUser() {
  const [state, setState] = useState({
    user: null,
    email: null,
    accessToken: null,
    loading: isSupabaseMode,
  })

  useEffect(() => {
    if (!isSupabaseMode || !supabase) {
      setState({ user: null, email: null, accessToken: null, loading: false })
      return
    }

    let cancelled = false

    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      setState({
        user: session?.user || null,
        email: session?.user?.email || null,
        accessToken: session?.access_token || null,
        loading: false,
      })
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setState({
        user: s?.user || null,
        email: s?.user?.email || null,
        accessToken: s?.access_token || null,
        loading: false,
      })
    })

    return () => {
      cancelled = true
      sub?.subscription?.unsubscribe()
    }
  }, [])

  return state
}
