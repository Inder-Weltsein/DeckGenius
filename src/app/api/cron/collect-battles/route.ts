/**
 * /api/cron/collect-battles — BFS収集Cron
 *
 * 設計書 v1.2 Sprint 2 に準拠
 * 1. visitedリセット: 7日以上前に訪問済みのプレイヤーを再訪問対象にする
 * 2. 3層シード: キューが枯渇しそうなら Top200 から自動補充
 * 3. BFS本体: player_pool から未訪問プレイヤーを処理
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
const RESEED_THRESHOLD = 50; // 未訪問プレイヤーがこの数を下回ったらシード再投入
const REVISIT_DAYS = 7; // この日数を超えたプレイヤーを再訪問対象にする

// 3層シード用ロケーションID（Clash Royale API）
const SEED_LOCATIONS = [
    { id: "global", name: "グローバル" },
    { id: "57000114", name: "日本" },
];

/**
 * API呼び出し（指数バックオフ + 429ハンドリング付き）
 */
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${API_TOKEN}` },
        });

        if (res.status === 429) {
            if (attempt === maxRetries) throw new Error("429 Too Many Requests: リトライ上限");
            const retryAfter = parseInt(res.headers.get("retry-after") || "2", 10);
            const delay = Math.max(retryAfter * 1000, 1000 * Math.pow(2, attempt));
            console.warn(`[collect-battles] 429, ${delay}ms後にリトライ (${attempt + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, delay));
            continue;
        }

        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res;
    }
    throw new Error("リトライ上限到達");
}

async function fetchBattleLog(tag: string) {
    const encodedTag = encodeURIComponent(tag.startsWith("#") ? tag : `#${tag}`);
    const res = await fetchWithRetry(`${API_BASE}/players/${encodedTag}/battlelog`);
    return res.json();
}

async function fetchPlayer(tag: string) {
    const encodedTag = encodeURIComponent(tag.startsWith("#") ? tag : `#${tag}`);
    const res = await fetchWithRetry(`${API_BASE}/players/${encodedTag}`);
    return res.json();
}

/**
 * 3層シード: グローバル/国別 Top200 からプレイヤーを player_pool に投入
 */
async function reseedFromLeaderboard(): Promise<number> {
    let seeded = 0;

    for (const loc of SEED_LOCATIONS) {
        try {
            const url = loc.id === "global"
                ? `${API_BASE}/locations/global/rankings/players?limit=200`
                : `${API_BASE}/locations/${loc.id}/rankings/players?limit=200`;
            const res = await fetchWithRetry(url);
            const data = await res.json();
            const players = data.items ?? [];

            const records = players.map((p: { tag: string; trophies?: number }) => ({
                player_tag: p.tag,
                current_trophies: p.trophies ?? 0,
                visited: false,
                source: `seed_${loc.id}`,
            }));

            if (records.length > 0) {
                const { error } = await supabase
                    .from("player_pool")
                    .upsert(records, { onConflict: "player_tag", ignoreDuplicates: true });
                if (!error) seeded += records.length;
            }

            console.log(`[reseed] ${loc.name}: ${records.length}名投入`);
        } catch (err) {
            console.error(`[reseed] ${loc.name}取得失敗:`, err);
        }
    }

    return seeded;
}

/**
 * visitedリセット: REVISIT_DAYS 日以上前に訪問したプレイヤーを再訪問対象にする
 */
async function resetStaleVisited(): Promise<number> {
    const cutoff = new Date(Date.now() - REVISIT_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from("player_pool")
        .update({ visited: false })
        .eq("visited", true)
        .lt("last_collected", cutoff)
        .select("player_tag");

    if (error) {
        console.error("[resetStale] リセット失敗:", error.message);
        return 0;
    }
    return data?.length ?? 0;
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
    let resetCount = 0;
    let seededCount = 0;
    const errors: string[] = [];

    try {
        // === Step 0: visitedリセット（7日経過したプレイヤーを再訪問対象に） ===
        resetCount = await resetStaleVisited();

        // === Step 1: キュー枯渇チェック → 3層シード自動補充 ===
        const { count: unvisitedCount } = await supabase
            .from("player_pool")
            .select("*", { count: "exact", head: true })
            .eq("visited", false);

        if ((unvisitedCount ?? 0) < RESEED_THRESHOLD) {
            seededCount = await reseedFromLeaderboard();
        }

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

        // === Step 2: BFS本体 ===
        const { data: queue } = await supabase
            .from("player_pool")
            .select("player_tag, arena_id")
            .eq("visited", false)
            .limit(MAX_PLAYERS_PER_RUN * 2);

        if (!queue || queue.length === 0) {
            return NextResponse.json({
                status: "no_queue",
                message: "未訪問プレイヤーなし",
                reset_count: resetCount,
                seeded_count: seededCount,
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
            reset_count: resetCount,
            seeded_count: seededCount,
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
