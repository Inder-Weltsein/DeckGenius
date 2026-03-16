import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { deckToVector } from "@/lib/engine/embedding/vectorize";

// タイムアウトなどを考慮した 1回あたりの最大処理件数（Google Gemini APIのRate Limitも考慮）
const BATCH_SIZE = 30;

export async function GET(request: Request) {
    // Cronリクエスト認証 (Vercel環境向け)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // ローカル開発用（localhostへのアクセス）は許可する
        const host = request.headers.get("host");
        if (!host?.includes("localhost")) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
    }

    try {
        // 1. trend_scores から評価対象の全デッキキーを取得
        const { data: trendData, error: trendErr } = await supabase
            .from("trend_scores")
            .select("deck_key");
        
        if (trendErr) {
            throw new Error(`Failed to fetch trend_scores: ${trendErr.message}`);
        }

        // 重複を排除してユニークなデッキキーリストを作成
        const uniqueDeckKeys = Array.from(new Set(trendData?.map(d => d.deck_key) || []));

        // 2. 既にベクトル化されているデッキキーを取得
        const { data: vectorData, error: vectorErr } = await supabase
            .from("deck_vectors")
            .select("deck_key");

        if (vectorErr) {
            throw new Error(`Failed to fetch deck_vectors: ${vectorErr.message}`);
        }

        const existingVectorKeys = new Set(vectorData?.map(d => d.deck_key) || []);

        // 3. 未登録のデッキを抽出（バッチサイズ上限で切り出し）
        const missingKeys = uniqueDeckKeys
            .filter(key => !existingVectorKeys.has(key))
            .slice(0, BATCH_SIZE);

        if (missingKeys.length === 0) {
            return NextResponse.json({
                status: "success",
                message: "すべてのデッキがベクトル化されています。",
                processed: 0
            });
        }

        console.log(`[update-embeddings] ベクトル化開始: ${missingKeys.length}件`);

        // 4. Gemini APIを呼び出してベクトル生成 -> DB保存
        let successCount = 0;
        let failCount = 0;

        for (const deckKey of missingKeys) {
            try {
                // deck_keyはカード名が"_"で連結されているため、配列に戻す
                const cardNames = deckKey.split("_");
                
                // Geminiを使って768次元ベクトルを生成
                const embedding = await deckToVector(cardNames);

                // Supabase (pgvector) にUPSERT
                const { error: insertErr } = await supabase
                    .from("deck_vectors")
                    .upsert({
                        deck_key: deckKey,
                        embedding: `[${embedding.join(',')}]`, // PostgreSQL vector形式に合わせて文字列化
                    }, { onConflict: "deck_key" });

                if (insertErr) {
                    console.error(`[update-embeddings] DB保存失敗: ${deckKey}:`, insertErr.message);
                    failCount++;
                } else {
                    successCount++;
                    // GeminiのRate Limit (例えば 15 RPM 等) を避けるため、1リクエストごとに1秒待機
                    await new Promise(r => setTimeout(r, 1000));
                }

            } catch (err: any) {
                console.error(`[update-embeddings] Gemini生成失敗: ${deckKey}:`, err.message);
                failCount++;
            }
        }

        return NextResponse.json({
            status: "success",
            message: `ベクトル化処理完了. 成功: ${successCount}, 失敗: ${failCount}`,
            processed: successCount
        });

    } catch (err: any) {
        console.error("[update-embeddings] 全体エラー:", err);
        return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
    }
}
