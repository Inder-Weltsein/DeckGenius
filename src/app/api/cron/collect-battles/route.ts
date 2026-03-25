/**
 * /api/cron/collect-battles — BFS収集Cron
 *
 * 実装計画書 v2.0 Sprint 0 + Sprint 1 対応:
 *   F-2: arena_id を visited 時に正規化
 *   Sprint1: reseedMiddle() でクラン検索から中帯プレイヤーを補充
 *   PoL: グローバルランキングを pathOfLegend エンドポイントに変更
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveBattleLog, getArenaCategoryId } from "@/lib/engine/battleCollector";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const API_BASE = process.env.CLASH_API_BASE || "https://api.clashroyale.com/v1";
const API_TOKEN = process.env.CLASH_API_TOKEN;

// 設定
const MAX_PLAYERS_PER_RUN = 10;
const ARENA_CAP = 1000;           // アリーナ帯あたりの最大バトル数（7日間）
const RESEED_THRESHOLD = 50;      // 未訪問プレイヤーがこの数以下でシード補充
const MIDDLE_RESEED_THRESHOLD = 30; // 中帯プレイヤーがこの数以下でクランシード補充
const REVISIT_DAYS = 7;

// Top帯シード（PoLランキング）
const TOP_SEED_LOCATIONS = [
    { id: "global",    name: "グローバル", endpoint: "pathoflegend" },
    { id: "57000114",  name: "日本",       endpoint: "pathoflegend" },
];

/**
 * API呼び出し（指数バックオフ + 429ハンドリング）
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
 * Top帯シード: PoLランキングから player_pool に投入
 */
async function reseedFromLeaderboard(): Promise<number> {
    let seeded = 0;

    for (const loc of TOP_SEED_LOCATIONS) {
        try {
            const url = loc.id === "global"
                ? `${API_BASE}/locations/global/pathoflegend/players?limit=200`
                : `${API_BASE}/locations/${loc.id}/pathoflegend/players?limit=200`;

            const res = await fetchWithRetry(url);
            const data = await res.json();
            const players = data.items ?? [];

            const records = players.map((p: { tag: string; trophies?: number }) => ({
                player_tag: p.tag,
                current_trophies: p.trophies ?? 0,
                arena_id: getArenaCategoryId(p.trophies ?? 0),
                visited: false,
                source: `seed_${loc.id}`,
            }));

            if (records.length > 0) {
                const { error } = await supabase
                    .from("player_pool")
                    .upsert(records, { onConflict: "player_tag", ignoreDuplicates: true });
                if (!error) seeded += records.length;
            }

            console.log(`[reseed-top] ${loc.name}: ${records.length}名投入`);
        } catch (err) {
            console.error(`[reseed-top] ${loc.name}取得失敗:`, err);
        }
    }

    return seeded;
}

/**
 * 中帯シード: クラン検索から champion/master 帯プレイヤーを補充
 * トロフィー 5,000〜9,000 のプレイヤーを対象
 */
async function reseedMiddle(): Promise<number> {
    let seeded = 0;

    try {
        // クランスコア100,000前後 = 平均6,000〜8,000杯クラン
        const url = `${API_BASE}/clans?minScore=80000&limit=20`;
        const res = await fetchWithRetry(url);
        const data = await res.json();
        const clans: { tag: string; name: string }[] = data.items ?? [];

        for (const clan of clans.slice(0, 5)) {
            try {
                const membersRes = await fetchWithRetry(
                    `${API_BASE}/clans/${encodeURIComponent(clan.tag)}/members`
                );
                const membersData = await membersRes.json();
                const members: { tag: string; trophies: number }[] = membersData.items ?? [];

                const midPlayers = members
                    .filter(m => m.trophies >= 5000 && m.trophies < 9000)
                    .map(m => ({
                        player_tag: m.tag,
                        current_trophies: m.trophies,
                        arena_id: getArenaCategoryId(m.trophies),
                        visited: false,
                        source: "seed_middle_clan",
                    }));

                if (midPlayers.length > 0) {
                    const { error } = await supabase
                        .from("player_pool")
                        .upsert(midPlayers, { onConflict: "player_tag", ignoreDuplicates: true });
                    if (!error) seeded += midPlayers.length;
                }

                console.log(`[reseed-middle] ${clan.name}: ${midPlayers.length}名投入`);
                await new Promise(r => setTimeout(r, 300));
            } catch (err) {
                console.error(`[reseed-middle] ${clan.tag}失敗:`, err);
            }
        }
    } catch (err) {
        console.error("[reseed-middle] クラン検索失敗:", err);
    }

    return seeded;
}

/**
 * visitedリセット: REVISIT_DAYS日以上前に訪問したプレイヤーを再訪問対象に
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
    let seededTop = 0;
    let seededMiddle = 0;
    const errors: string[] = [];

    try {
        // === Step 0: visitedリセット ===
        resetCount = await resetStaleVisited();

        // === Step 1: キュー状態確認 ===
        const { count: unvisitedTotal } = await supabase
            .from("player_pool")
            .select("*", { count: "exact", head: true })
            .eq("visited", false);

        // 中帯未訪問プレイヤー数
        const { count: unvisitedMiddle } = await supabase
            .from("player_pool")
            .select("*", { count: "exact", head: true })
            .eq("visited", false)
            .in("arena_id", ["champion", "master"]);

        // Top帯シード補充
        if ((unvisitedTotal ?? 0) < RESEED_THRESHOLD) {
            seededTop = await reseedFromLeaderboard();
        }

        // 中帯シード補充（champion/master が不足したら）
        if ((unvisitedMiddle ?? 0) < MIDDLE_RESEED_THRESHOLD) {
            seededMiddle = await reseedMiddle();
        }

        // === Step 2: ARENA_CAP チェック（F-2: 7日間バトル数） ===
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

        // === Step 3: BFS本体 ===
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
                seeded_top: seededTop,
                seeded_middle: seededMiddle,
                elapsed_ms: Date.now() - startTime,
            });
        }

        // ARENA_CAP未達のアリーナのプレイヤーを優先
        const candidates = queue.filter(p => {
            if (!p.arena_id) return true;
            return (arenaCountMap.get(p.arena_id) ?? 0) < ARENA_CAP;
        });

        const toProcess = (candidates.length > 0 ? candidates : queue).slice(0, MAX_PLAYERS_PER_RUN);

        for (const player of toProcess) {
            if (Date.now() - startTime > 50000) break;

            try {
                const playerInfo = await fetchPlayer(player.player_tag);
                const trophies = playerInfo.trophies ?? 0;
                const arenaId = getArenaCategoryId(trophies);

                const battles = await fetchBattleLog(player.player_tag);
                const { saved, newPlayers } = await saveBattleLog(
                    player.player_tag,
                    trophies,
                    battles
                );

                // F-2: arena_id を正規化して更新
                await supabase
                    .from("player_pool")
                    .update({
                        visited: true,
                        current_trophies: trophies,
                        arena_id: arenaId,
                        last_collected: new Date().toISOString(),
                    })
                    .eq("player_tag", player.player_tag);

                totalSaved += saved;
                totalNewPlayers += newPlayers;
                processed++;

                await new Promise(r => setTimeout(r, 500));
            } catch (err) {
                errors.push(`${player.player_tag}: ${String(err)}`);
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
            seeded_top: seededTop,
            seeded_middle: seededMiddle,
            arena_counts: Object.fromEntries(arenaCountMap),
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
