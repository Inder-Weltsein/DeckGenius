-- Supabase Security Fix: Enable Row Level Security (RLS)
-- 警告「RLS Disabled in Public」を解消し、匿名ユーザー（Anon）からの直接アクセスを遮断します。
-- ※本アプリケーションはバックエンド（API）で Service Role Key を使用しているため、
--   RLSを有効にしても正常に動作を継続します。

-- 1. raw_battles テーブルのRLS有効化
ALTER TABLE public.raw_battles ENABLE ROW LEVEL SECURITY;

-- 2. player_pool テーブルのRLS有効化
ALTER TABLE public.player_pool ENABLE ROW LEVEL SECURITY;

-- 3. trend_scores テーブルのRLS有効化
ALTER TABLE public.trend_scores ENABLE ROW LEVEL SECURITY;

-- 4. arena_meta_aggregated テーブルのRLS有効化
ALTER TABLE public.arena_meta_aggregated ENABLE ROW LEVEL SECURITY;

-- 5. deck_vectors テーブルのRLS有効化
ALTER TABLE public.deck_vectors ENABLE ROW LEVEL SECURITY;

-- ※ポリシー（Policy）を何も作成しない場合、デフォルトで「すべてのアクセスを拒否」となります。
-- Service Role はこの制限をバイパスするため、バックエンドAPIからの読み書きのみが許可される安全な状態になります。
