-- =============================================
-- DeckGenius Phase 2: recommend_logs テーブル
-- Supabase の SQL Editor で実行してください
-- =============================================

-- 推薦ログ: 各推薦リクエストの結果を記録
-- Phase 2 で推薦デッキ × 実際の勝敗を分析するための観測データ
CREATE TABLE IF NOT EXISTS recommend_logs (
    id              BIGSERIAL PRIMARY KEY,
    player_tag      TEXT NOT NULL,
    trophies        INT NOT NULL DEFAULT 0,
    recommended_deck TEXT NOT NULL,
    compatibility_score INT NOT NULL DEFAULT 0,
    alternative_count INT NOT NULL DEFAULT 0,
    is_demo         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_recommend_logs_player ON recommend_logs (player_tag);
CREATE INDEX IF NOT EXISTS idx_recommend_logs_time ON recommend_logs (created_at DESC);

-- RLS: サービスロール経由のみ書き込み可能
ALTER TABLE public.recommend_logs ENABLE ROW LEVEL SECURITY;
