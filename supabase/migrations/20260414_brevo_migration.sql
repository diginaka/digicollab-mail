-- ================================================================
-- デジコラボ メール Brevo移行 スキーマ変更
-- 2026-04-14
-- ================================================================
-- 目的:
--   1. mail_connections テーブルを MailerLite → Brevo 向けに拡張
--      (Brevo は認証済み送信者を必ず選ぶため default_sender_* を追加)
--   2. delivery_queue テーブルを新規作成
--      (フロービルダー → 自動配信の予約状況を追跡)
-- ================================================================

-- ----------------------------------------------------------------
-- 1. mail_connections の拡張（既存テーブルがある前提で ALTER）
-- ----------------------------------------------------------------
-- 既存の provider カラムを追加（デフォルト brevo）
ALTER TABLE public.mail_connections
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'brevo';

-- Brevoアカウント情報
ALTER TABLE public.mail_connections
  ADD COLUMN IF NOT EXISTS account_email text;

ALTER TABLE public.mail_connections
  ADD COLUMN IF NOT EXISTS plan_name text;

ALTER TABLE public.mail_connections
  ADD COLUMN IF NOT EXISTS credits bigint DEFAULT 0;

ALTER TABLE public.mail_connections
  ADD COLUMN IF NOT EXISTS credits_type text;

-- デフォルト送信者（Brevo認証済み送信元）
ALTER TABLE public.mail_connections
  ADD COLUMN IF NOT EXISTS default_sender_email text;

ALTER TABLE public.mail_connections
  ADD COLUMN IF NOT EXISTS default_sender_name text;

-- 最終検証日時（接続テスト成功時刻）
ALTER TABLE public.mail_connections
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

-- provider による検索を高速化
CREATE INDEX IF NOT EXISTS idx_mail_connections_provider
  ON public.mail_connections (provider);

-- ----------------------------------------------------------------
-- 2. delivery_queue テーブル新規作成
-- ----------------------------------------------------------------
-- フロービルダー → 自動配信セットアップで Brevo に予約送信した
-- トランザクショナルメールの一覧を保持する。
-- 配信進捗を UI で可視化するための台帳。
CREATE TABLE IF NOT EXISTS public.delivery_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- フロービルダー側の識別子
  funnel_id text NOT NULL,
  funnel_name text,

  -- ステップ情報
  step_number integer NOT NULL,
  step_content_id uuid,       -- generated_step_contents の row
  subject text,

  -- 宛先
  recipient_email text NOT NULL,

  -- 配信予約時刻（Brevo の scheduledAt と一致）
  scheduled_at timestamptz NOT NULL,

  -- ステータス: scheduled, sending, sent, failed, cancelled
  status text NOT NULL DEFAULT 'scheduled',

  -- Brevo から返却されたメッセージID（追跡用）
  brevo_message_id text,

  -- 失敗時のエラーメッセージ
  error_message text,

  -- 作成者（Supabase auth.users への参照 / NULL 許可でスタンドアロン対応）
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_queue_funnel_id
  ON public.delivery_queue (funnel_id);

CREATE INDEX IF NOT EXISTS idx_delivery_queue_status
  ON public.delivery_queue (status);

CREATE INDEX IF NOT EXISTS idx_delivery_queue_scheduled_at
  ON public.delivery_queue (scheduled_at);

CREATE INDEX IF NOT EXISTS idx_delivery_queue_created_by
  ON public.delivery_queue (created_by);

-- updated_at の自動更新トリガ
CREATE OR REPLACE FUNCTION public.set_delivery_queue_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_queue_updated_at ON public.delivery_queue;
CREATE TRIGGER trg_delivery_queue_updated_at
  BEFORE UPDATE ON public.delivery_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.set_delivery_queue_updated_at();

-- ----------------------------------------------------------------
-- 3. Row Level Security
-- ----------------------------------------------------------------
ALTER TABLE public.delivery_queue ENABLE ROW LEVEL SECURITY;

-- 自分の予約のみ読める
DROP POLICY IF EXISTS delivery_queue_select_own ON public.delivery_queue;
CREATE POLICY delivery_queue_select_own
  ON public.delivery_queue
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL);

-- 自分の予約のみ追加できる
DROP POLICY IF EXISTS delivery_queue_insert_own ON public.delivery_queue;
CREATE POLICY delivery_queue_insert_own
  ON public.delivery_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

-- 自分の予約のみ更新できる
DROP POLICY IF EXISTS delivery_queue_update_own ON public.delivery_queue;
CREATE POLICY delivery_queue_update_own
  ON public.delivery_queue
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL)
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

-- 自分の予約のみ削除できる
DROP POLICY IF EXISTS delivery_queue_delete_own ON public.delivery_queue;
CREATE POLICY delivery_queue_delete_own
  ON public.delivery_queue
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL);

-- ----------------------------------------------------------------
-- 4. 参考: generated_step_contents テーブル（既存想定）
-- ----------------------------------------------------------------
-- こちらは digicollab flow 側のスキーマなので本マイグレーションでは触らない。
-- 参照カラム例:
--   id uuid
--   funnel_id text
--   funnel_name text
--   pattern_name text
--   channel text ('email' | 'sms' | ...)
--   step_number integer
--   step_label text
--   subject text
--   body text
--   metadata jsonb (delay_days など)
