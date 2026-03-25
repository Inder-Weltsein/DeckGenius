/**
 * battleCollector.ts — バトルログ副次保存ユーティリティ
 *
 * 実装計画書 v2.0 Sprint 0 対応:
 *   F-1: generateDeckKeyFromCards でevo/hero状態をdeck_keyに反映
 *   F-2: 対戦相手のopponent_trophies を記録し arena_id を正規化
 *   新規: battle_type (PvP / pathOfLegend) を保存
 */

import type { Battle, BattleCard } from "../clashApi";
import { supabase } from "../supabaseClient";
import { generateDeckKeyFromCards } from "../engine/deckKey";

/**
 * アリーナ帯カテゴリIDを取得（BFS/集計用）
 */
export function getArenaCategoryId(trophies: number): string {
    if (trophies >= 15000) return "ultimate";
    if (trophies >= 12000) return "top-ladder";
    if (trophies >= 10000) return "grandmaster";
    if (trophies >= 8000) return "champion";
    if (trophies >= 6000) return "master";
    if (trophies >= 4000) return "challenger";
    return "beginner";
}

/**
 * Clash Royale固有の時刻文字列 "20240313T123456.000Z" を標準のDateに変換する
 */
function parseCRTime(timeStr: string): Date {
    if (!timeStr || timeStr.length < 15) return new Date();
    if (timeStr.includes("-")) return new Date(timeStr);
    const y = timeStr.substring(0, 4);
    const m = timeStr.substring(4, 6);
    const d = timeStr.substring(6, 8);
    const h = timeStr.substring(9, 11);
    const min = timeStr.substring(11, 13);
    const sec = timeStr.substring(13, 15);
    return new Date(`${y}-${m}-${d}T${h}:${min}:${sec}.000Z`);
}

/**
 * バトルログをDBに非同期保存する
 * 採否ゲート: 7日以内のPvP / pathOfLegend バトルのみ保存
 */
export async function saveBattleLog(
    playerTag: string,
    trophies: number,
    battles: Battle[]
): Promise<{ saved: number; newPlayers: number }> {
    const arenaCategory = getArenaCategoryId(trophies);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const battleRecords: Record<string, unknown>[] = [];
    const newPlayerTags = new Set<string>();

    for (const battle of battles) {
        // ゲート: PvP / pathOfLegend のみ（チャレンジ・トーナメント除外）
        if (battle.type !== "PvP" && battle.type !== "pathOfLegend") continue;

        // ゲート: 鮮度チェック — 7日以内
        const battleTime = parseCRTime(battle.battleTime);
        if (battleTime < sevenDaysAgo) continue;

        const team = battle.team?.[0];
        const opponent = battle.opponent?.[0];
        if (!team?.cards || !opponent?.cards) continue;

        const isWin = (team.crowns ?? team.crownsEarned ?? 0) > (opponent.crowns ?? opponent.crownsEarned ?? 0);

        // F-1: カードオブジェクトをそのまま渡して evo/hero を識別
        const deckKey = generateDeckKeyFromCards(team.cards as BattleCard[]);
        const opponentDeckKey = generateDeckKeyFromCards(opponent.cards as BattleCard[]);

        // カード名のみ保存（表示・検索用）
        const deckCards = team.cards.map((c: BattleCard) => c.name);
        const deckEvoMap = Object.fromEntries(
            team.cards.map((c: BattleCard) => [
                c.name,
                c.iconUrls?.heroMedium ? "hero" : (c.evolutionLevel ?? 0) >= 1 ? "evo" : "normal",
            ])
        );

        battleRecords.push({
            player_tag: playerTag,
            opponent_tag: opponent.tag ?? "unknown",
            arena_id: arenaCategory,
            trophies,
            deck_key: deckKey,
            opponent_deck_key: opponentDeckKey,
            deck_cards: deckCards,
            deck_evo_map: deckEvoMap,   // 各カードの進化状態
            is_win: isWin,
            battle_type: battle.type,  // "PvP" | "pathOfLegend"
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
        if (battleRecords.length > 0) {
            const { error } = await supabase
                .from("raw_battles")
                .upsert(battleRecords, {
                    onConflict: "player_tag,battle_time,deck_key",
                    ignoreDuplicates: true,
                });

            if (!error) {
                saved = battleRecords.length;
            } else {
                console.error("[battleCollector] バトル保存エラー:", error.message);
            }
        }

        // プレイヤー自身を player_pool に登録/更新（arena_id含む）
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
        // ※ トロフィー情報がないため arena_id は訪問時に更新される
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
                    ignoreDuplicates: true,
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
