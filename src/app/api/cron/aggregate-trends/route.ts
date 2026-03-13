/**
 * /api/cron/aggregate-trends — 勝率集計Cron
 *
 * 設計書 v1.0 §3 に準拠
 * raw_battles（直近7日）からアリーナ帯×デッキキー単位で
 * Wilson WR / WR Delta / Velocity / Composite Score を算出し
 * trend_scores テーブルを更新する。
 *
 * 実行間隔: 6時間ごと（vercel.json で設定）
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { wilsonWinRate, calcWrDelta, calcVelocity, calcCompositeScore, getSampleQuality } from "@/lib/engine/wilsonStats";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// アリーナ帯リスト
const ARENA_IDS = ["beginner", "challenger", "master", "champion", "grandmaster", "top-ladder", "ultimate"];

interface DeckStats {
    deck_key: string;
    wins_7d: number;
    total_7d: number;
    wins_14d: number;
    total_14d: number;
}

export async function GET(req: NextRequest) {
    // Cronセキュリティ: Vercel Cronトークン検証
    const authHeader = req.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startTime = Date.now();
    const results: Record<string, { decks: number; battles: number }> = {};

    try {
        for (const arenaId of ARENA_IDS) {
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

            // 直近7日のバトルデータ集計
            const { data: battles7d } = await supabase
                .from("raw_battles")
                .select("deck_key, is_win")
                .eq("arena_id", arenaId)
                .gte("battle_time", sevenDaysAgo.toISOString());

            // 直近14日のバトルデータ集計
            const { data: battles14d } = await supabase
                .from("raw_battles")
                .select("deck_key, is_win")
                .eq("arena_id", arenaId)
                .gte("battle_time", fourteenDaysAgo.toISOString());

            if (!battles7d || battles7d.length === 0) {
                results[arenaId] = { decks: 0, battles: 0 };
                continue;
            }

            // デッキ別に集計
            const deckMap = new Map<string, DeckStats>();

            for (const b of battles7d) {
                const stats = deckMap.get(b.deck_key) ?? {
                    deck_key: b.deck_key,
                    wins_7d: 0,
                    total_7d: 0,
                    wins_14d: 0,
                    total_14d: 0,
                };
                stats.total_7d++;
                if (b.is_win) stats.wins_7d++;
                deckMap.set(b.deck_key, stats);
            }

            if (battles14d) {
                for (const b of battles14d) {
                    const stats = deckMap.get(b.deck_key);
                    if (stats) {
                        stats.total_14d++;
                        if (b.is_win) stats.wins_14d++;
                    }
                }
            }

            // アリーナ全体の平均WR変化（パッチ影響の除去用）
            let totalWr7d = 0, totalWr14d = 0, deckCount = 0;
            for (const stats of deckMap.values()) {
                if (stats.total_7d >= 10 && stats.total_14d >= 10) {
                    totalWr7d += stats.wins_7d / stats.total_7d;
                    totalWr14d += stats.wins_14d / stats.total_14d;
                    deckCount++;
                }
            }
            const arenaMeanDelta = deckCount > 0
                ? (totalWr7d / deckCount) - (totalWr14d / deckCount)
                : 0;

            // 全アリーナのバトル総数（Velocity計算用）
            const totalBattles7d = battles7d.length;
            const totalBattles14d = battles14d?.length ?? 0;

            // trend_scores に upsert
            const upsertRecords = [];
            for (const stats of deckMap.values()) {
                const wilson = wilsonWinRate(stats.wins_7d, stats.total_7d);

                const wr7d = stats.total_7d > 0 ? stats.wins_7d / stats.total_7d : 0;
                const wr14d = stats.total_14d > 0 ? stats.wins_14d / stats.total_14d : 0;

                // WR Delta: 各窓50戦未満は計算しない
                const wrDelta = (stats.total_7d >= 50 && stats.total_14d >= 50)
                    ? calcWrDelta(wr7d, wr14d, arenaMeanDelta)
                    : 0;

                // Velocity
                const usageRate7d = totalBattles7d > 0 ? stats.total_7d / totalBattles7d : 0;
                const usageRate14d = totalBattles14d > 0 ? stats.total_14d / totalBattles14d : 0;
                const velocity = calcVelocity(usageRate7d, usageRate14d);

                const composite = calcCompositeScore(wilson, wrDelta, velocity);

                upsertRecords.push({
                    arena_id: arenaId,
                    deck_key: stats.deck_key,
                    composite_score: Math.round(composite * 100) / 100,
                    wilson_wr: Math.round(wilson * 10000) / 10000,
                    wr_delta: Math.round(wrDelta * 10000) / 10000,
                    velocity: Math.round(velocity * 10000) / 10000,
                    sample_count: stats.total_7d,
                    updated_at: new Date().toISOString(),
                });
            }

            if (upsertRecords.length > 0) {
                await supabase
                    .from("trend_scores")
                    .upsert(upsertRecords, { onConflict: "arena_id,deck_key" });
            }

            // arena_meta_aggregated を更新
            const topDecks = upsertRecords
                .sort((a, b) => b.composite_score - a.composite_score)
                .slice(0, 20);

            const quality = getSampleQuality(battles7d.length);

            await supabase
                .from("arena_meta_aggregated")
                .upsert({
                    arena_id: arenaId,
                    top_decks: topDecks,
                    total_battles_analyzed: battles7d.length,
                    sample_quality: quality,
                    data_source: quality === "insufficient" ? "static" : "real",
                    last_updated: new Date().toISOString(),
                }, { onConflict: "arena_id" });

            results[arenaId] = { decks: upsertRecords.length, battles: battles7d.length };
        }

        const elapsed = Date.now() - startTime;
        return NextResponse.json({
            status: "success",
            elapsed_ms: elapsed,
            results,
        });
    } catch (err) {
        console.error("[aggregate-trends] エラー:", err);
        return NextResponse.json(
            { error: "集計処理に失敗しました", details: String(err) },
            { status: 500 }
        );
    }
}
