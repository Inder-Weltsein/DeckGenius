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
            const topScores = upsertRecords
                .sort((a, b) => b.composite_score - a.composite_score)
                .slice(0, 20);

            const quality = getSampleQuality(battles7d.length);

            // raw_battles から上位デッキのカードリストを一括取得
            const topDeckKeys = topScores.map(d => d.deck_key);
            const { data: deckSamples } = await supabase
                .from("raw_battles")
                .select("deck_key, deck_cards")
                .in("deck_key", topDeckKeys)
                .eq("arena_id", arenaId)
                .limit(topDeckKeys.length * 3);

            const deckCardsMap = new Map<string, string[]>();
            if (deckSamples) {
                for (const sample of deckSamples) {
                    if (!deckCardsMap.has(sample.deck_key)) {
                        deckCardsMap.set(sample.deck_key, sample.deck_cards);
                    }
                }
            }

            // ArenaDeckStats 形式に変換してフロントエンドが直接利用できる形で保存
            const topDecks = topScores.map(d => {
                const cards: string[] = deckCardsMap.get(d.deck_key) ??
                    d.deck_key.split("_")
                        .filter((c: string) => c !== "evo" && c !== "hero")
                        .map((c: string) =>
                            c.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
                        );
                const trend: "up" | "down" | "stable" =
                    d.wr_delta > 0.02 ? "up" : d.wr_delta < -0.02 ? "down" : "stable";
                const useRate = totalBattles7d > 0
                    ? Math.round((deckMap.get(d.deck_key)?.total_7d ?? 0) / totalBattles7d * 1000) / 10
                    : 0;
                return {
                    deckId: d.deck_key,
                    deckName: cards.slice(0, 2).join(" + "),
                    archetype: "real",
                    cards,
                    winRate: Math.round(d.wilson_wr * 1000) / 10,
                    useRate,
                    avgElixir: 0,
                    trend,
                };
            });

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

        // ─────────────────────────────────────────────────────────────
        // [Sprint 3] マッチアップ行列集計
        // raw_battles の opponent_deck_key を使いデッキ対決勝率を集計
        // ─────────────────────────────────────────────────────────────
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const { data: matchupBattles } = await supabase
                .from("raw_battles")
                .select("arena_id, deck_key, opponent_deck_key, is_win")
                .gte("battle_time", sevenDaysAgo.toISOString())
                .not("opponent_deck_key", "is", null);

            if (matchupBattles && matchupBattles.length > 0) {
                // arena × deck_key × opponent_deck_key 単位で集計
                const matchupMap = new Map<string, { wins: number; total: number }>();
                for (const b of matchupBattles) {
                    if (!b.opponent_deck_key) continue;
                    const key = `${b.arena_id}||${b.deck_key}||${b.opponent_deck_key}`;
                    const cur = matchupMap.get(key) ?? { wins: 0, total: 0 };
                    cur.total++;
                    if (b.is_win) cur.wins++;
                    matchupMap.set(key, cur);
                }

                // MIN_MATCHUP_SAMPLE = 5件以上のみ保存（ノイズ除去）
                const matchupRecords = [];
                for (const [key, stats] of matchupMap.entries()) {
                    if (stats.total < 5) continue;
                    const [arena_id, deck_key, opponent_deck_key] = key.split("||");
                    matchupRecords.push({
                        arena_id, deck_key, opponent_deck_key,
                        wins: stats.wins,
                        total: stats.total,
                        updated_at: new Date().toISOString(),
                    });
                }

                if (matchupRecords.length > 0) {
                    await supabase
                        .from("matchup_stats")
                        .upsert(matchupRecords, { onConflict: "arena_id,deck_key,opponent_deck_key" });
                    console.log(`[aggregate-trends] マッチアップ行列: ${matchupRecords.length}件更新`);
                }
            }
        } catch (matchupErr) {
            console.warn("[aggregate-trends] マッチアップ集計エラー（無視）:", matchupErr);
        }

        const elapsed = Date.now() - startTime;

        // ─────────────────────────────────────────────────────────────
        // Vercel Hobby プランの Cron 制限（2枠）回避：
        // aggregate-trends 完了直後に update-embeddings を連鎖実行する。
        // Cron スロットを消費せずに「収集→集計→ベクトル化」を1本化する。
        // ─────────────────────────────────────────────────────────────
        let embeddingResult: { processed?: number; message?: string } = {};
        try {
            // リクエストの host ヘッダーからベースURLを動的に構築
            // ローカル: http://localhost:3001  Vercel: https://xxx.vercel.app
            const host = req.headers.get("host") ?? "localhost:3000";
            const proto = host.startsWith("localhost") ? "http" : "https";
            const baseUrl = process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : `${proto}://${host}`;

            const embResp = await fetch(`${baseUrl}/api/cron/update-embeddings`, {
                headers: {
                    authorization: process.env.CRON_SECRET
                        ? `Bearer ${process.env.CRON_SECRET}`
                        : "",
                },
            });

            if (embResp.ok) {
                embeddingResult = await embResp.json();
                console.log("[aggregate-trends] update-embeddings 連鎖完了:", embeddingResult.message);
            } else {
                console.warn("[aggregate-trends] update-embeddings 連鎖失敗:", embResp.status);
            }
        } catch (embErr) {
            // 連鎖失敗でもメイン処理の成功レスポンスは返す
            console.warn("[aggregate-trends] update-embeddings 連鎖エラー（無視）:", embErr);
        }

        return NextResponse.json({
            status: "success",
            elapsed_ms: elapsed,
            results,
            embeddings: embeddingResult,
        });
    } catch (err) {
        console.error("[aggregate-trends] エラー:", err);
        return NextResponse.json(
            { error: "集計処理に失敗しました", details: String(err) },
            { status: 500 }
        );
    }
}
