/**
 * battleCollector.ts — バトルログ副次保存ユーティリティ
 *
 * 設計書 v1.0 §2 に準拠
 * ユーザー検索時にバトルログをDBに非同期保存する。
 * BFSの起点: 対戦相手のタグを player_pool に自動登録。
 */

import type { Battle } from "../clashApi";
import { supabase } from "../supabaseClient";
import { generateDeckKey } from "../engine/deckKey";
import { getArenaByTrophies } from "../arenaMeta";

/**
 * アリーナ帯カテゴリIDを取得（BFS/集計用）
 */
function getArenaCategoryId(trophies: number): string {
    if (trophies >= 15000) return "ultimate";
    if (trophies >= 12000) return "top-ladder";
    if (trophies >= 10000) return "grandmaster";
    if (trophies >= 8000) return "champion";
    if (trophies >= 6000) return "master";
    if (trophies >= 4000) return "challenger";
    return "beginner";
}

/**
 * バトルログをDBに非同期保存する
 * 採否ゲート準拠: 7日以内のPvPバトルのみ保存
 *
 * @param playerTag プレイヤータグ
 * @param trophies 現在トロフィー
 * @param battles バトルログ（最大25件）
 */
export async function saveBattleLog(
    playerTag: string,
    trophies: number,
    battles: Battle[]
): Promise<{ saved: number; newPlayers: number }> {
    const arenaCategory = getArenaCategoryId(trophies);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const battleRecords: any[] = [];
    const newPlayerTags = new Set<string>();

    for (const battle of battles) {
        // ゲート1: PvPのみ（チャレンジ・トーナメント除外）
        if (battle.type !== "PvP" && battle.type !== "pathOfLegend") continue;

        // ゲート1: 鮮度チェック — 7日以内
        const battleTime = new Date(battle.battleTime);
        if (battleTime < sevenDaysAgo) continue;

        const team = battle.team?.[0];
        const opponent = battle.opponent?.[0];
        if (!team?.cards || !opponent?.cards) continue;

        const isWin = (team.crownsEarned ?? 0) > (opponent.crownsEarned ?? 0);
        const deckCards = team.cards.map(c => c.name);
        const deckKey = generateDeckKey(deckCards);

        battleRecords.push({
            player_tag: playerTag,
            opponent_tag: opponent.tag ?? "unknown",
            arena_id: arenaCategory,
            trophies,
            deck_key: deckKey,
            deck_cards: deckCards,
            is_win: isWin,
            battle_time: battleTime.toISOString(),
        });

        // BFS: 対戦相手のタグを発見
        if (opponent.tag && opponent.tag !== "unknown") {
            newPlayerTags.add(opponent.tag);
        }
    }

    let saved = 0;
    let newPlayers = 0;

    try {
        // バトルレコード保存（バッチ挿入）
        if (battleRecords.length > 0) {
            const { error } = await supabase
                .from("raw_battles")
                .insert(battleRecords);

            if (!error) {
                saved = battleRecords.length;
            } else {
                console.error("[battleCollector] バトル保存エラー:", error.message);
            }
        }

        // プレイヤー自身を player_pool に登録/更新
        await supabase
            .from("player_pool")
            .upsert({
                player_tag: playerTag,
                arena_id: arenaCategory,
                current_trophies: trophies,
                visited: true,
                last_collected: new Date().toISOString(),
                source: "user_search",
            }, { onConflict: "player_tag" });

        // BFS: 対戦相手を player_pool に未訪問として登録
        if (newPlayerTags.size > 0) {
            const newPlayerRecords = Array.from(newPlayerTags).map(tag => ({
                player_tag: tag,
                visited: false,
                source: "bfs",
            }));

            const { error } = await supabase
                .from("player_pool")
                .upsert(newPlayerRecords, {
                    onConflict: "player_tag",
                    ignoreDuplicates: true, // 既存は上書きしない
                });

            if (!error) {
                newPlayers = newPlayerTags.size;
            }
        }
    } catch (err) {
        console.error("[battleCollector] 保存処理で予期せぬエラー:", err);
    }

    return { saved, newPlayers };
}
