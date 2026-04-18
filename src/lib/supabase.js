// 二刀流モード: Supabase環境変数が設定されていればsupabaseモード、なければstandalone
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseMode = Boolean(url && anonKey)

// 他のデジコラボアプリ（カート/コース/LINE等）とセッションストレージキーが衝突しないよう
// ユニークなstorageKeyを指定。これにより、アプリ単位でセッションを独立管理できる。
export const supabase = isSupabaseMode
  ? createClient(url, anonKey, {
      auth: {
        storageKey: 'sb-digicollab-mail',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // SSOで手動制御するため無効化
      },
    })
  : null

// ローカルストレージラッパー（standaloneモード用）
const LS_PREFIX = 'digicollab_mail_'

export const localStore = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value))
    } catch {}
  },
  remove(key) {
    try {
      localStorage.removeItem(LS_PREFIX + key)
    } catch {}
  },
}
