-- ============================================================
-- DeckGenius v2.0 Sprint 3 マイグレーション
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 1. マッチアップ行列テーブル
--    deck_key × opponent_deck_key の勝率を記録
CREATE TABLE IF NOT EXISTS public.matchup_stats (
    id              BIGSERIAL PRIMARY KEY,
    arena_id        TEXT NOT NULL,
    deck_key        TEXT NOT NULL,
    opponent_deck_key TEXT NOT NULL,
    wins            INT  NOT NULL DEFAULT 0,
    total           INT  NOT NULL DEFAULT 0,
    win_rate        FLOAT GENERATED ALWAYS AS (
                        CASE WHEN total > 0 THEN wins::float / total ELSE 0 END
                    ) STORED,
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (arena_id, deck_key, opponent_deck_key)
);

CREATE INDEX IF NOT EXISTS idx_matchup_deck
    ON public.matchup_stats (arena_id, deck_key, win_rate DESC);

CREATE INDEX IF NOT EXISTS idx_matchup_opponent
    ON public.matchup_stats (arena_id, opponent_deck_key, win_rate DESC);

ALTER TABLE public.matchup_stats ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY は IF NOT EXISTS 非対応のため DO ブロックで冪等実行
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'matchup_stats'
          AND policyname = 'matchup_stats public read'
    ) THEN
        CREATE POLICY "matchup_stats public read"
            ON public.matchup_stats FOR SELECT TO anon USING (true);
    END IF;
END $$;

-- 2. recommend_logs の統計ビュー（表示用）
CREATE OR REPLACE VIEW public.recommend_logs_stats AS
SELECT
    DATE_TRUNC('day', created_at) AS day,
    COUNT(*)                       AS total_requests,
    COUNT(*) FILTER (WHERE is_demo = false) AS real_requests,
    AVG(compatibility_score)       AS avg_score,
    AVG(alternative_count)         AS avg_alternatives
FROM public.recommend_logs
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;
