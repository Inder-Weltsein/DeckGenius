-- DeckGenius v2: 新テーブル構造
-- 設計書 v1.0 に準拠

-- ============================================
-- 1. raw_battles: BFS収集した1試合1行の生データ
-- ============================================
CREATE TABLE IF NOT EXISTS raw_battles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_tag TEXT NOT NULL,
  opponent_tag TEXT NOT NULL,
  arena_id TEXT NOT NULL,
  trophies INT NOT NULL,
  deck_key TEXT NOT NULL,
  deck_cards TEXT[] NOT NULL,
  is_win BOOLEAN NOT NULL,
  battle_time TIMESTAMPTZ NOT NULL,
  collected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_arena ON raw_battles(arena_id);
CREATE INDEX IF NOT EXISTS idx_raw_time ON raw_battles(collected_at);
CREATE INDEX IF NOT EXISTS idx_raw_deck ON raw_battles(deck_key);
CREATE INDEX IF NOT EXISTS idx_raw_player ON raw_battles(player_tag);

-- ============================================
-- 2. player_pool: 訪問済みプレイヤー管理（BFS用）
-- ============================================
CREATE TABLE IF NOT EXISTS player_pool (
  player_tag TEXT PRIMARY KEY,
  arena_id TEXT,
  current_trophies INT,
  visited BOOLEAN DEFAULT FALSE,
  last_collected TIMESTAMPTZ,
  source TEXT DEFAULT 'bfs'
);

CREATE INDEX IF NOT EXISTS idx_pool_visited ON player_pool(visited);
CREATE INDEX IF NOT EXISTS idx_pool_arena ON player_pool(arena_id);

-- ============================================
-- 3. trend_scores: Composite Score（②エンジン出力）
-- ============================================
CREATE TABLE IF NOT EXISTS trend_scores (
  arena_id TEXT NOT NULL,
  deck_key TEXT NOT NULL,
  composite_score FLOAT DEFAULT 0,
  wilson_wr FLOAT DEFAULT 0,
  wr_delta FLOAT DEFAULT 0,
  velocity FLOAT DEFAULT 0,
  sample_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (arena_id, deck_key)
);

-- ============================================
-- 4. arena_meta_aggregated: フロントエンド用集計済みデータ
-- ============================================
CREATE TABLE IF NOT EXISTS arena_meta_aggregated (
  arena_id TEXT PRIMARY KEY,
  top_decks JSONB NOT NULL DEFAULT '[]'::jsonb,
  card_stats JSONB DEFAULT '[]'::jsonb,
  total_battles_analyzed INT DEFAULT 0,
  sample_quality TEXT DEFAULT 'static',
  data_source TEXT DEFAULT 'static',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
