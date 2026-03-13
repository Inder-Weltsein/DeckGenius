/**
 * /api/cron/collect-battles — BFS収集Cron
 *
 * 設計書 v1.0 §2 に準拠
 * player_pool から未訪問プレイヤーを取り出し、
 * バトルログを取得してDBに保存する。
 *
 * ゲート2: アリーナ帯キャップ — 各arenaの記録数が閾値未満の場合のみ収集
 * Vercel制限: 最大60秒/実行
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveBattleLog } from "@/lib/engine/battleCollector";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// APIトークン
const API_BASE = process.env.CLASH_API_BASE || "https://api.clashroyale.com/v1";
const API_TOKEN = process.env.CLASH_API_TOKEN;

// 設定
const MAX_PLAYERS_PER_RUN = 10; // 60秒制限を考慮
const ARENA_CAP = 1000; // ゲート2: アリーナ帯あたりの最大バトル数

async function fetchBattleLog(tag: string) {
    const encodedTag = encodeURIComponent(tag.startsWith("#") ? tag : `#${tag}`);
    const res = await fetch(`${API_BASE}/players/${encodedTag}/battlelog`, {
        headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

async function fetchPlayer(tag: string) {
    const encodedTag = encodeURIComponent(tag.startsWith("#") ? tag : `#${tag}`);
    const res = await fetch(`${API_BASE}/players/${encodedTag}`, {
        headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

export async function GET(req: NextRequest) {
    // Cronセキュリティ
    const authHeader = req.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!API_TOKEN) {
        return NextResponse.json({ error: "APIトークン未設定" }, { status: 500 });
    }

    const startTime = Date.now();
    let processed = 0;
    let totalSaved = 0;
    let totalNewPlayers = 0;
    const errors: string[] = [];

    try {
        // ゲート2: アリーナ帯別のバトル数を確認
        const { data: arenaCounts } = await supabase
            .from("raw_battles")
            .select("arena_id")
            .gte("battle_time", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        const arenaCountMap = new Map<string, number>();
        if (arenaCounts) {
            for (const row of arenaCounts) {
                arenaCountMap.set(row.arena_id, (arenaCountMap.get(row.arena_id) ?? 0) + 1);
            }
        }

        // 未訪問プレイヤーを取得（キャップに達していないアリーナのプレイヤー優先）
        const { data: queue } = await supabase
            .from("player_pool")
            .select("player_tag, arena_id")
            .eq("visited", false)
            .limit(MAX_PLAYERS_PER_RUN * 2);

        if (!queue || queue.length === 0) {
            return NextResponse.json({
                status: "no_queue",
                message: "未訪問プレイヤーなし",
                elapsed_ms: Date.now() - startTime,
            });
        }

        // キャップに達していないアリーナのプレイヤーを優先
        const candidates = queue.filter(p => {
            if (!p.arena_id) return true;
            return (arenaCountMap.get(p.arena_id) ?? 0) < ARENA_CAP;
        });

        const toProcess = (candidates.length > 0 ? candidates : queue).slice(0, MAX_PLAYERS_PER_RUN);

        for (const player of toProcess) {
            // 60秒タイムアウト防止
            if (Date.now() - startTime > 50000) break;

            try {
                // プレイヤー情報取得（トロフィー確認）
                const playerInfo = await fetchPlayer(player.player_tag);
                const trophies = playerInfo.trophies ?? 0;

                // バトルログ取得
                const battles = await fetchBattleLog(player.player_tag);

                // DB保存
                const { saved, newPlayers } = await saveBattleLog(
                    player.player_tag,
                    trophies,
                    battles
                );

                // 訪問済みマーク
                await supabase
                    .from("player_pool")
                    .update({
                        visited: true,
                        current_trophies: trophies,
                        last_collected: new Date().toISOString(),
                    })
                    .eq("player_tag", player.player_tag);

                totalSaved += saved;
                totalNewPlayers += newPlayers;
                processed++;

                // レート制限対策: 500ms間隔
                await new Promise(r => setTimeout(r, 500));
            } catch (err) {
                errors.push(`${player.player_tag}: ${String(err)}`);
                // エラーでも訪問済みにする（無限リトライ防止）
                await supabase
                    .from("player_pool")
                    .update({ visited: true })
                    .eq("player_tag", player.player_tag);
            }
        }

        return NextResponse.json({
            status: "success",
            processed,
            battles_saved: totalSaved,
            new_players_discovered: totalNewPlayers,
            errors: errors.length > 0 ? errors : undefined,
            elapsed_ms: Date.now() - startTime,
        });
    } catch (err) {
        console.error("[collect-battles] エラー:", err);
        return NextResponse.json(
            { error: "BFS収集処理に失敗", details: String(err) },
            { status: 500 }
        );
    }
}
