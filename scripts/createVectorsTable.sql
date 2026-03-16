-- ==========================================
-- DeckGenius Phase 2: Gemini Embedding & pgvector Setup
-- 実行方法: SupabaseのSQL Editorに貼り付けてRUNしてください。
-- ==========================================

-- 1. pgvector拡張を有効化（プロジェクトで初めて利用する場合のみ必要）
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. deck_vectors テーブルの作成（すでに存在する場合はスキップ）
CREATE TABLE IF NOT EXISTS deck_vectors (
    deck_key       TEXT        PRIMARY KEY,     -- 既存のtrend_scoresと同じデッキキー形式
    embedding      vector(768) NOT NULL,        -- text-embedding-004の次元数
    archetype_id   INT,                         -- 自動判定されたクラスタID（または既存メタIDベース）
    updated_at     TIMESTAMPTZ DEFAULT now()
);

-- 3. コサイン距離による高次元インデックス（HNSW）の作成
-- ※ cosine distance <=> 演算子を高速化します。
CREATE INDEX IF NOT EXISTS idx_dv_embedding 
ON deck_vectors USING hnsw (embedding vector_cosine_ops);

-- アーキタイプ検索を高速化するためのインデックス
CREATE INDEX IF NOT EXISTS idx_dv_archetype ON deck_vectors (archetype_id);

-- ==========================================
-- RPC Functions (Stored Procedures)
-- ==========================================

-- 4. 近傍の類似デッキ検索（Top N件）
-- 目的: 新興デッキ（trend_scores未登録）の勝率を周辺の実績から加重推論するため。
CREATE OR REPLACE FUNCTION find_similar_decks(
  query_embedding vector(768),
  target_arena_id text,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  deck_key text,
  composite_score real,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    dv.deck_key,
    ts.composite_score,
    -- コサイン距離 (<=>) から類似度 (1 - distance) へ変換
    1 - (dv.embedding <=> query_embedding) AS similarity
  FROM deck_vectors dv
  -- 勝率実績のあるものを対象とするため trend_scores と結合
  JOIN trend_scores ts ON ts.deck_key = dv.deck_key
  WHERE ts.arena_id = target_arena_id
  ORDER BY dv.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 5. アーキタイプの動的判定
-- 目的: 対象のデッキに最も近い（類似度 > 0.85）のデッキが持つアーキタイプIDを割り当てる。
CREATE OR REPLACE FUNCTION find_archetype(
  query_embedding vector(768),
  similarity_threshold float DEFAULT 0.85
)
RETURNS INT
LANGUAGE sql STABLE
AS $$
  SELECT archetype_id
  FROM deck_vectors
  WHERE archetype_id IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > similarity_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT 1;
$$;
