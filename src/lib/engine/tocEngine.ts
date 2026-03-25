/**
 * tocEngine.ts — 新TOCエンジン本体（4軸アリーナ別動的重み）
 *
 * 設計書 v1.0 §4 に準拠
 * 旧5軸固定重みを廃止し、「ハードフィルター → ソフトスコアリング」の
 * 2段階構造で「このユーザーがこのデッキで勝てる確率」を推定する。
 */

import type { CRCard, Battle } from "../clashApi";
import type { MetaDeck } from "../metaDecks";
import { checkRoles, countTag, hasTag, type RoleCheckResult } from "../cards";
import { getCardDef } from "../cards";
import { isPlayable } from "./hardFilter";
import { getArenaTier, getTOCWeights, type ArenaTier } from "./arenaWeights";
import { generateDeckKey } from "./deckKey";
import { supabase } from "../supabaseClient";
import { deckToVector } from "./embedding/vectorize";
import { getArenaCategoryId } from "../engine/battleCollector";

// sample_count が この閾値未満のデッキはメタスコアを信頼しない
const MIN_SAMPLE_COUNT = 30;

// ===== 型定義 =====

export interface TOCScoreBreakdown {
    growthScore: number;
    metaScore: number;
    structureScore: number;
    costScore: number;
}

export interface ScoredDeck {
    deck: MetaDeck;
    resolvedCards: CRCard[];
    totalScore: number;
    breakdown: TOCScoreBreakdown;
    roleCheck: RoleCheckResult;
    sampleCount: number;
    filterReason?: string;
    inferredArchetypeId?: number | null; // 動的割り当てされたアーキタイプID
}

// ===== ヘルパー: 絶対レベル変換 =====

export function toAbsoluteCards(cards: CRCard[]): CRCard[] {
    return cards.map(c => {
        const def = getCardDef(c.name);
        let baseLevel = 1;
        if (def) {
            if (def.rarity === "common") baseLevel = 1;
            else if (def.rarity === "rare") baseLevel = 3;
            else if (def.rarity === "epic") baseLevel = 6;
            else if (def.rarity === "legendary") baseLevel = 9;
            else if (def.rarity === "champion") baseLevel = 11;
        } else {
            if (c.maxLevel === 14 || c.maxLevel === 15) baseLevel = 1;
            else if (c.maxLevel === 12 || c.maxLevel === 13) baseLevel = 3;
            else if (c.maxLevel === 9 || c.maxLevel === 10) baseLevel = 6;
            else if (c.maxLevel === 6 || c.maxLevel === 7) baseLevel = 9;
            else if (c.maxLevel === 4 || c.maxLevel === 5) baseLevel = 11;
        }
        const absLevel = Math.min(15, Math.max(1, baseLevel + c.level - 1));
        return { ...c, level: absLevel, maxLevel: 15 };
    });
}

// ===== ローカルメタ分析 =====

export function analyzeLocalMeta(battles: Battle[]): { cardName: string; count: number }[] {
    const counter: Record<string, number> = {};
    for (const battle of battles.slice(0, 25)) {
        const opponent = battle.opponent?.[0];
        if (!opponent?.cards) continue;
        for (const card of opponent.cards) {
            counter[card.name] = (counter[card.name] ?? 0) + 1;
        }
    }
    return Object.entries(counter)
        .map(([cardName, count]) => ({ cardName, count }))
        .sort((a, b) => b.count - a.count);
}

export function analyzeLossMeta(battles: Battle[]): Record<string, number> {
    const counter: Record<string, number> = {};
    const losses = battles.filter(
        b => (b.team?.[0]?.crowns ?? b.team?.[0]?.crownsEarned ?? 0) < (b.opponent?.[0]?.crowns ?? b.opponent?.[0]?.crownsEarned ?? 0)
    );
    for (const battle of losses.slice(0, 15)) {
        const opponent = battle.opponent?.[0];
        if (!opponent?.cards) continue;
        for (const card of opponent.cards) {
            counter[card.name] = (counter[card.name] ?? 0) + 1;
        }
    }
    return counter;
}

// ===== ① 育成スコア (0〜100) =====

function calcGrowthScore(
    metaDeck: MetaDeck,
    playerCards: CRCard[]
): { score: number; resolvedCards: CRCard[] } {
    const cardMap = new Map<string, CRCard>(
        playerCards.map(c => [c.name.toLowerCase(), c])
    );

    const resolvedCards: CRCard[] = [];
    let totalWeightedRatio = 0;
    let totalWeight = 0;

    for (const cardName of metaDeck.cards) {
        const owned = cardMap.get(cardName.toLowerCase());
        if (!owned) continue; // ハードフィルターで排除済みのため、ここには来ないはず

        resolvedCards.push(owned);
        const ratio = owned.level / 15;

        // win_conditionは2倍重み（設計書 §5 Table 15）
        const weight = hasTag(cardName, "win_condition") ? 2 : 1;
        totalWeightedRatio += ratio * weight;
        totalWeight += weight;
    }

    const avgRatio = totalWeight > 0 ? totalWeightedRatio / totalWeight : 0;
    const score = Math.max(0, Math.round(avgRatio * 100));

    return { score, resolvedCards };
}

// ===== ② メタスコア (0〜100) =====
// DB(trend_scores)のComposite Scoreを参照 + ローカル補正

async function calcMetaScore(
    metaDeck: MetaDeck,
    arenaId: string,   // "arena_19" 形式 (UI用)
    trophies: number,  // トロフィー数 → DB用カテゴリに変換
    localMeta: { cardName: string; count: number }[],
    lossMeta: Record<string, number>,
    battleCount: number
): Promise<{ score: number; sampleCount: number; inferredArchetypeId?: number | null }> {
    // [2-4 C-1修正] arenaIdを"top-ladder"等のDBカテゴリに変換
    const dbArenaId = getArenaCategoryId(trophies);
    const deckKey = generateDeckKey(metaDeck.cards);
    let dbScore = 50;
    let sampleCount = 0;
    let inferredArchetypeId: number | null = null;

    try {
        const { data, error } = await supabase
            .from("trend_scores")
            .select("composite_score, sample_count")
            .eq("arena_id", dbArenaId)
            .eq("deck_key", deckKey)
            .single();

        if (error) {
            throw error;
        }

        if (data) {
            sampleCount = data.sample_count ?? 0;
            // [2-1] sample_count < MIN_SAMPLE_COUNT は統計的に信頼不足 → 中立50点
            if (sampleCount >= MIN_SAMPLE_COUNT) {
                dbScore = data.composite_score ?? 50;
            } else {
                dbScore = 50;
            }
        }
    } catch (err: unknown) {
        // PGRST116 (No rows found) の場合は未登録（新興デッキ）とみなす
        if ((err as { code?: string }).code === "PGRST116") {
            try {
                // 1. 新興デッキのAIベクトル化
                const queryVector = await deckToVector(metaDeck.cards);

                // 2. [並行処理] 近傍類似スコア予測 ＆ アーキタイプ推測
                const [similarRes, archetypeRes] = await Promise.all([
                    supabase.rpc("find_similar_decks", {
                        query_embedding: `[${queryVector.join(',')}]`,
                        target_arena_id: dbArenaId,  // [2-4] 正規化済みカテゴリを使用
                        match_count: 5
                    }),
                    supabase.rpc("find_archetype", {
                        query_embedding: `[${queryVector.join(',')}]`,
                        similarity_threshold: 0.85
                    })
                ]);

                // 類似デッキから加重平均スコアの計算
                if (similarRes.data && Array.isArray(similarRes.data) && similarRes.data.length > 0) {
                    let totalWeightedScore = 0;
                    let totalWeight = 0;
                    for (const row of similarRes.data) {
                        const weight = Math.max(0, row.similarity); // 類似度を重みとする
                        totalWeightedScore += row.composite_score * weight;
                        totalWeight += weight;
                    }
                    if (totalWeight > 0) {
                        dbScore = totalWeightedScore / totalWeight;
                        // console.log(`[tocEngine] 推定スコア: ${dbScore.toFixed(2)} (${similarRes.data.length}件の類似から推論)`);
                    }
                }

                // アーキタイプIDの動的割り当て
                if (archetypeRes.data !== null && typeof archetypeRes.data === 'number') {
                    inferredArchetypeId = archetypeRes.data;
                }

            } catch (fallbackErr) {
                console.error("[tocEngine] フォールバック推論エラー:", fallbackErr);
                dbScore = Math.min(100, Math.max(0, (metaDeck.globalWinRate - 45) * 6.67));
            }
        } else {
            console.error("[tocEngine] DB取得エラー:", err);
            dbScore = Math.min(100, Math.max(0, (metaDeck.globalWinRate - 45) * 6.67));
        }
    }

    // ローカルメタ補正（±15点上限、10戦未満は適用しない）
    let localAdjust = 0;
    if (battleCount >= 10) {
        for (const { cardName, count } of localMeta.slice(0, 5)) {
            if (metaDeck.strongAgainst.some(s => s.toLowerCase() === cardName.toLowerCase())) {
                localAdjust += count * 3;
            }
            if (metaDeck.counters.some(c => c.toLowerCase() === cardName.toLowerCase())) {
                localAdjust -= count * 2;
            }
        }
        // 敗北メタ追加ペナルティ
        for (const [cardName, count] of Object.entries(lossMeta)) {
            if (metaDeck.counters.some(c => c.toLowerCase() === cardName.toLowerCase())) {
                localAdjust -= count * 1;
            }
        }
        // ±15点制限（設計書 §5 Table 15）
        localAdjust = Math.min(15, Math.max(-15, localAdjust));
    }

    const score = Math.min(100, Math.max(0, Math.round(dbScore + localAdjust)));
    return { score, sampleCount, inferredArchetypeId };
}

// ===== ③ 構造スコア (0〜100) =====
// 役割ペナルティ（動的係数）+ シナジーボーナス

function calcStructureScore(
    metaDeck: MetaDeck,
    playerCards: CRCard[],
    arenaAirDeckRatio: number = 0
): number {
    const cards = metaDeck.cards;
    const check = checkRoles(cards);

    let score = 100;

    // --- 動的役割ペナルティ ---

    // 主軸なし → -30（固定: 構造的欠陥）
    if (!check.hasWinCondition) score -= 30;

    // 対空ペナルティ: 動的（設計書 §4.3）
    // anti_air_penalty = -25 × (1 + arena_air_deck_ratio)
    if (check.antiAirCount === 0) {
        score -= Math.round(25 * (1 + arenaAirDeckRatio));
    } else if (check.antiAirCount === 1) {
        score -= Math.round(10 * (1 + arenaAirDeckRatio * 0.5));
    }

    // 呪文なし → -20（固定: 構造的欠陥）
    if (check.spellCount === 0) score -= 20;
    else if (check.spellCount >= 3) score -= 15;

    // タンク処理なし
    if (!check.hasTankKiller) score -= 15;

    // 範囲攻撃なし
    if (!check.hasSplash) score -= 10;

    // --- シナジーボーナス (0〜+20点) ---
    // 旧: 未定義=50点固定バイアス → 新: 未定義=中立+10点
    let synergyBonus = 10; // 中立ボーナス
    if (metaDeck.synergyPairs && metaDeck.synergyPairs.length > 0) {
        const ownedSet = new Set(playerCards.map(c => c.name.toLowerCase()));
        let matchedPairs = 0;
        const totalPairs = metaDeck.synergyPairs.length;

        for (const [a, b] of metaDeck.synergyPairs) {
            if (ownedSet.has(a.toLowerCase()) && ownedSet.has(b.toLowerCase())) {
                matchedPairs++;
            }
        }
        // 10 + (matched/total) × 10 → 最大+20点
        synergyBonus = 10 + Math.round((matchedPairs / totalPairs) * 10);
    }

    score += synergyBonus;
    return Math.min(100, Math.max(0, score));
}

// ===== ④ コストスコア (0〜100) =====

function calcCostScore(metaDeck: MetaDeck): number {
    const avg = metaDeck.avgElixir;
    const [idealMin, idealMax] = metaDeck.idealElixirRange;

    if (avg >= idealMin && avg <= idealMax) {
        const center = (idealMin + idealMax) / 2;
        const distFromCenter = Math.abs(avg - center);
        const range = (idealMax - idealMin) / 2;
        return Math.round(100 - (distFromCenter / range) * 15);
    }

    const outOfRange = avg < idealMin ? idealMin - avg : avg - idealMax;
    return Math.max(0, Math.round(80 - outOfRange * 25));
}

// ===== TOC統合スコア =====

export async function calcTOCScore(
    metaDeck: MetaDeck,
    playerCards: CRCard[],
    trophies: number,
    arenaId: string,
    localMeta: { cardName: string; count: number }[],
    lossMeta: Record<string, number>,
    battleCount: number,
    arenaAirDeckRatio: number = 0
): Promise<ScoredDeck> {
    // Step 1: ハードフィルター
    const playable = isPlayable(metaDeck, playerCards, trophies);
    if (!playable.isPlayable) {
        return {
            deck: metaDeck,
            resolvedCards: [],
            totalScore: -1, // フィルター済みは負のスコア
            breakdown: { growthScore: 0, metaScore: 0, structureScore: 0, costScore: 0 },
            roleCheck: checkRoles(metaDeck.cards),
            sampleCount: 0,
            filterReason: playable.reason,
        };
    }

    // Step 2: 4軸スコアリング
    const { score: growthScore, resolvedCards } = calcGrowthScore(metaDeck, playerCards);
    const { score: metaScore, sampleCount, inferredArchetypeId } = await calcMetaScore(metaDeck, arenaId, trophies, localMeta, lossMeta, battleCount);
    const structureScore = calcStructureScore(metaDeck, playerCards, arenaAirDeckRatio);
    const costScore = calcCostScore(metaDeck);

    // アリーナ別動的重み
    const tier = getArenaTier(trophies);
    const weights = getTOCWeights(tier);

    const totalScore =
        growthScore * weights.growth +
        metaScore * weights.meta +
        structureScore * weights.structure +
        costScore * weights.cost;

    // 決定論的タイブレーク: jitter廃止 → sample_countで解決
    const tiebreaker = Math.min(sampleCount / 10000, 0.01);

    const roleCheck = checkRoles(metaDeck.cards);

    return {
        deck: metaDeck,
        resolvedCards,
        totalScore: totalScore + tiebreaker,
        breakdown: { growthScore, metaScore, structureScore, costScore },
        roleCheck,
        sampleCount,
        inferredArchetypeId
    };
}
