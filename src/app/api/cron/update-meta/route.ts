import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Node.js または Edge Runtime で動作 (Vercel Cron推奨設定)
export const maxDuration = 60; // 実行制限時間を60秒に延長 (無料枠の最大値)
export const dynamic = 'force-dynamic'; // キャッシュさせない

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const cronSecret = process.env.CRON_SECRET;

export async function GET(request: Request) {
    // 1. セキュリティチェック：Vercelからの呼び出しかを確認
    const authHeader = request.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Missing Supabase Credentials" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        console.log('[Cron] Starting meta data simulation update...');

        // 2. 現在のすべてのメタデータをDBから取得
        const { data: allArenas, error: fetchError } = await supabaseAdmin
            .from('arena_meta_stats')
            .select('arena_id, top_decks, total_analyzed_battles');

        if (fetchError || !allArenas) {
            throw new Error(fetchError?.message || "Failed to fetch current arena stats");
        }

        // 3. 各アリーナのトップデッキの勝率・使用率をランダムに微小変動させる（±1%の推移シミュレーション）
        let updateCount = 0;

        for (const arenaData of allArenas) {
            const updatedDecks = arenaData.top_decks.map((deck: any) => {
                // 勝率の変動 (-1.0% 〜 +1.0%)
                const winRateChange = (Math.random() * 2 - 1);
                // 使用率の変動 (-0.5% 〜 +0.5%)
                const useRateChange = (Math.random() * 1 - 0.5);

                const newWinRate = Math.min(100, Math.max(0, deck.winRate + winRateChange));
                const newUseRate = Math.min(100, Math.max(0, deck.useRate + useRateChange));

                // トレンド(trend)の更新（上昇/下降/フラット）
                let trend = "flat";
                if (winRateChange > 0.3) trend = "up";
                else if (winRateChange < -0.3) trend = "down";

                return {
                    ...deck,
                    winRate: parseFloat(newWinRate.toFixed(1)),
                    useRate: parseFloat(newUseRate.toFixed(1)),
                    trend: trend
                };
            });

            // 4. 更新した配列を再度Supabaseへ書き込む
            const { error: updateError } = await supabaseAdmin
                .from('arena_meta_stats')
                .update({
                    top_decks: updatedDecks,
                    total_analyzed_battles: arenaData.total_analyzed_battles + Math.floor(Math.random() * 500) // サンプル数も少し増やす
                })
                .eq('arena_id', arenaData.arena_id);

            if (updateError) {
                console.error(`[Cron] Error updating ${arenaData.arena_id}:`, updateError.message);
            } else {
                updateCount++;
            }
        }

        console.log(`[Cron] Metadata update simulation completed for ${updateCount} arenas.`);

        return NextResponse.json({
            success: true,
            message: `Updated ${updateCount} arenas successfully.`,
            timestamp: new Date().toISOString()
        });

    } catch (e: any) {
        console.error('[Cron] Fatal error during execution:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
