// ログイン中ユーザーのメアドから business_profiles を引いて business_profile_id を取得。
// fb_optin_email_sequences の upsert / fb-optin-submit テスト送信のために必須。
import { useEffect, useState } from 'react'
import { supabase, isSupabaseMode } from '../lib/supabase'

export function useBusinessProfile(userEmail) {
  const [state, setState] = useState({
    profile: null,
    profileId: null,
    loading: false,
    error: null,
  })

  useEffect(() => {
    if (!isSupabaseMode || !supabase || !userEmail) {
      setState({ profile: null, profileId: null, loading: false, error: null })
      return
    }

    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))

    ;(async () => {
      try {
        // is_default = true を最優先、なければ最も新しい profile を採用
        const { data, error } = await supabase
          .from('business_profiles')
          .select('id, name, is_default, updated_at')
          .eq('user_email', userEmail)
          .order('is_default', { ascending: false, nullsFirst: false })
          .order('updated_at', { ascending: false })
          .limit(1)

        if (cancelled) return
        if (error) throw error

        const profile = data?.[0] || null
        setState({
          profile,
          profileId: profile?.id || null,
          loading: false,
          error: null,
        })
      } catch (err) {
        if (cancelled) return
        setState({
          profile: null,
          profileId: null,
          loading: false,
          error: err.message || 'business_profile の取得に失敗しました',
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userEmail])

  return state
}
