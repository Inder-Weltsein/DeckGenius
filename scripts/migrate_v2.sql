-- ============================================================
-- DeckGenius v2.0 マイグレーション
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 1. raw_battles に新カラム追加
ALTER TABLE public.raw_battles
    ADD COLUMN IF NOT EXISTS battle_type     TEXT,
    ADD COLUMN IF NOT EXISTS opponent_deck_key TEXT,
    ADD COLUMN IF NOT EXISTS deck_evo_map    JSONB;

-- 2. インデックス追加（帯別・タイプ別クエリ高速化）
CREATE INDEX IF NOT EXISTS idx_raw_battles_arena_time
    ON public.raw_battles (arena_id, battle_time DESC);

CREATE INDEX IF NOT EXISTS idx_raw_battles_battle_type
    ON public.raw_battles (battle_type);

CREATE INDEX IF NOT EXISTS idx_raw_battles_opponent_deck
    ON public.raw_battles (opponent_deck_key);

-- 3. player_pool の arena_id インデックス追加
CREATE INDEX IF NOT EXISTS idx_player_pool_arena_visited
    ON public.player_pool (arena_id, visited);

-- ============================================================
-- データリセット（v2.0再収集のため）
-- 注意: 実行すると全データが消えます
-- ============================================================

-- TRUNCATE public.raw_battles;
-- TRUNCATE public.trend_scores;
-- TRUNCATE public.deck_vectors;
-- UPDATE public.player_pool SET visited = false, last_collected = null;

-- ============================================================
-- 上記 TRUNCATE を実行する場合は以下を1行ずつコメント解除して実行
-- ============================================================
