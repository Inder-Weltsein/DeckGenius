-- DeckGenius: RLS 設定（冪等・何度実行しても安全）
-- Supabase の SQL Editor で実行してください
-- ※ 既存ポリシーがあってもエラーにならない

-- ─────────────────────────────────────────────
-- 1. RLS を有効化（ALTER TABLE は既存でもエラーにならない）
-- ─────────────────────────────────────────────
ALTER TABLE public.raw_battles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_pool           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_scores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_meta_aggregated ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_vectors          ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- 2. ポリシー設定（既存を一旦削除してから再作成 → 冪等）
-- ─────────────────────────────────────────────

-- arena_meta_aggregated: 匿名ユーザーも読み取り可（フロントエンド表示用）
DROP POLICY IF EXISTS "Allow public read access" ON public.arena_meta_aggregated;
CREATE POLICY "Allow public read access"
ON public.arena_meta_aggregated FOR SELECT
USING (true);

-- ─────────────────────────────────────────────
-- 3. 確認クエリ（実行後にこれを単独で実行して確認）
-- ─────────────────────────────────────────────
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE tablename IN ('raw_battles','player_pool','trend_scores','arena_meta_aggregated','deck_vectors')
-- ORDER BY tablename;
--
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('arena_meta_aggregated','trend_scores','raw_battles','player_pool')
-- ORDER BY tablename;
