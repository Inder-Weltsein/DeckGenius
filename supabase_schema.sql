-- DeckGenius Supabase Schema

-- アリーナメタ統計情報のテーブル
-- 取得したメタデッキ（トップ層のデッキのリスト）などをJSONとして保存
CREATE TABLE arena_meta_stats (
    id SERIAL PRIMARY KEY,
    arena_id VARCHAR(50) NOT NULL UNIQUE,       -- 例: "arena_22", "arena_15"
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    top_decks JSONB NOT NULL,                   -- 格納されるJSON: { deckId, deckName, archetype, cards[], winRate, useRate, trend } の配列
    total_analyzed_battles INTEGER DEFAULT 0    -- 参考: 母数となる分析した試合数 (例: 25000)
);

-- RLS (Row Level Security) の設定（読み取りは全員OK、書き込みは認証またはサーバーからのみ）
ALTER TABLE arena_meta_stats ENABLE ROW LEVEL SECURITY;

-- 匿名ユーザー（公開Webサイトからのアクセス）には読み取り(SELECT)のみを許可するポリシー
CREATE POLICY "Allow public read access" 
ON arena_meta_stats FOR SELECT 
USING (true);
